# AgentKit Integration Design

**Date**: 2026-03-29
**Status**: Approved
**Scope**: Integrate Worldcoin AgentKit into the NanoClaw agent-server for both inbound protection and outbound authentication.

## Problem Statement

The agent-server currently authenticates requests using a shared secret between the Next.js app and the agent-server. This means:
- Any client with the shared secret can send messages to any agent
- There's no way to distinguish human-backed agents from bots/scripts when external agents interact with the platform
- Our agents cannot prove their human-backed identity when consuming external AgentKit-protected services

AgentKit solves both problems by linking agent wallets to anonymous human identities via World App verification.

## Architecture Overview

```
External Agent --> POST /message (with x-agentkit-proof header)
                       |
                       v
               +---------------------+
               |  AgentKit Middleware |  <-- NEW: verifies AgentBook proof
               |  (Express middleware)|      OR owner bypass via shared secret
               +---------+-----------+
                         | verified
                         v
               +---------------------+
               |  Existing Express   |  /message, /stream, /register-group
               |  Webapp Channel     |
               +---------+-----------+
                         | spawns container
                         v
               +---------------------+
               |  Docker Container   |  gets AGENTKIT_* env vars injected
               |  (Claude Agent SDK) |
               +---------+-----------+
                         | outbound x402 request
                         v
               +---------------------+
               |  Credential Proxy   |  /agentkit/sign --> signs outbound
               |  :3001              |  AgentKit proofs using agent's wallet
               +---------------------+
```

### Two Integration Points

1. **Inbound (server-side protection)**: Express middleware on `/message` and service routes verifies incoming AgentKit proofs via AgentBook. Owner requests from Next.js with the shared secret bypass this entirely.

2. **Outbound (agent-side capability)**: New `/agentkit/sign` route on the credential proxy at `:3001`. Containers call this to get AgentKit-signed proofs for external services, using the agent's existing encrypted wallet.

## Architectural Decisions

### ADR-1: Express Middleware vs. Separate Sidecar Service

**Decision**: Express middleware on the existing agent-server.

**Why**: The agent-server is a single Express process handling all webapp traffic. Adding a separate Hono sidecar (as the AgentKit docs suggest) would introduce a second service, a second port, Docker networking between them, and health check complexity. The current architecture doesn't need that — one middleware layer achieves the same result with zero new infrastructure.

**Trade-off**: If the agent-server were ever split into microservices, the middleware would need to be extracted. At current scale (single VPS, <50 agents), this is not a concern.

### ADR-2: Credential Proxy for Outbound Signing vs. Per-Container Credentials

**Decision**: Extend the credential proxy with `/agentkit/sign` rather than injecting private keys into containers.

**Why**: The credential proxy pattern already exists for Anthropic API keys, wallet signing, and Uniswap API keys. Containers never see real secrets — they hit `http://host.docker.internal:3001/wallet/*` and the proxy handles decryption and signing. AgentKit outbound signing follows the exact same pattern.

**Trade-off**: Adds latency (container -> proxy -> sign -> return) vs. having the key in-container. But this is the same trade-off already accepted for wallet operations, and security (containers never hold private keys) outweighs the ~1ms overhead.

### ADR-3: Owner Bypass via Shared Secret

**Decision**: Requests with a valid `x-shared-secret` header skip AgentKit verification entirely.

**Why**: The Next.js app communicates with the agent-server using a shared secret. Users chatting with their own agents should never be gated by AgentKit — they're the owner. The shared secret already authenticates the Next.js app, so we trust it as the owner path. This means zero breaking changes to the existing flow.

### ADR-4: Supabase for AgentKit Storage (not SQLite)

**Decision**: Store usage counters and nonces in Supabase, not the local SQLite database.

**Why**: SQLite is local to the agent-server container and gets wiped on redeployment. Usage counters and nonce replay protection must survive deploys. Supabase is already used for wallet keys, trades, and holdings — adding two more tables is natural.

### ADR-5: One World App Verification Per User

**Decision**: Users verify once via World App. All agents they create share that human verification.

**Why**: Requiring per-agent verification would force users through World App for every agent they create — terrible UX. Instead, the user's World ID verification is linked to their account, and each agent wallet they create inherits that verification status during the AgentBook registration step.

### ADR-6: Environment Injection for Outbound AgentKit (not a Skill)

**Decision**: Inject `AGENTKIT_ENABLED=true` and `AGENTKIT_SIGN_URL` as environment variables into containers, rather than adding an agentkit skill.

**Why**: AgentKit authentication is a transport-level concern. The agent shouldn't "decide" to use AgentKit — it should happen automatically when the HTTP client detects an AgentKit-protected endpoint. Skills are for agent-level decisions (e.g., "should I trade?"). Transport auth is infrastructure.

## Components

### 1. AgentKit Middleware (`agent-server/src/agentkit-middleware.ts`)

New Express middleware applied to `/message` and service endpoints.

**Request classification**:

| Request Type | Detection | Behavior |
|---|---|---|
| Owner request | Valid `x-shared-secret` header | Bypass AgentKit, proceed normally |
| AgentKit-verified agent | Valid `x-agentkit-proof` header | Verify via AgentBook, apply free-trial, allow or 402 |
| Unverified request | Neither header | Reject 401 with registration instructions |

**Free-trial logic**:
- 3 free uses per verified human identity per endpoint
- After exhaustion, return 402 Payment Required with x402 payment options
- Usage tracked in `agentkit_usage` Supabase table

**Verification flow**:
1. Extract proof from `x-agentkit-proof` header
2. Call `agentBook.verify(proof)` to resolve anonymous human ID
3. Check nonce hasn't been replayed (`agentkit_nonces` table)
4. Record nonce
5. Check usage count for this human ID + endpoint
6. If under limit: increment usage, proceed
7. If over limit: return 402 with payment options

### 2. Credential Proxy Extension (`agent-server/src/credential-proxy.ts`)

New route `/agentkit/sign` on the existing credential proxy.

**Request**: `POST /agentkit/sign` with `X-Agent-Id` header and body `{ url, method, body? }`
**Response**: `{ proof: string }` — the signed AgentKit proof header value

**Flow**:
1. Extract agent ID from `X-Agent-Id` header
2. Recover agent's private key (existing `getAgentAccount()`)
3. Sign the request using AgentKit SDK's signing helpers
4. Return the proof string for the container to attach as a header

### 3. Container Environment Injection (`agent-server/src/container-runner.ts`)

Add to `buildContainerArgs()`:
```
-e AGENTKIT_ENABLED=true
-e AGENTKIT_SIGN_URL=http://<host-gateway>:<proxy-port>/agentkit/sign
```

These are injected alongside existing `AGENT_ID` and `CREDENTIAL_PROXY_URL` env vars.

### 4. AgentBook Registration Flow

During agent registration (`POST /register-group`), after wallet creation:
1. Check if the creating user has a World ID verification on file
2. If yes, register the new agent wallet in AgentBook using the CLI or SDK
3. Store registration status in the `agent_wallet_keys` table (new column: `agentbook_registered`)

For the initial implementation, registration is a manual step via CLI:
```
npx @worldcoin/agentkit-cli register <agent-wallet-address>
```

Automated registration will follow once we integrate the World App verification flow into the Next.js frontend.

### 5. Supabase Migration (`010_agentkit.sql`)

Two new tables:

```sql
-- Usage tracking for AgentKit free-trial mode
CREATE TABLE IF NOT EXISTS agentkit_usage (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    endpoint TEXT NOT NULL,
    human_id TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(endpoint, human_id)
);

-- Nonce replay protection
CREATE TABLE IF NOT EXISTS agentkit_nonces (
    nonce TEXT PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_agentkit_usage_lookup ON agentkit_usage(endpoint, human_id);

-- Add AgentBook registration status to wallet keys
ALTER TABLE agent_wallet_keys
    ADD COLUMN IF NOT EXISTS agentbook_registered BOOLEAN DEFAULT false;
```

### 6. New Dependencies

**agent-server/package.json**:
```
@worldcoin/agentkit  — SDK for verification, signing, storage interface
```

## Data Flow: Inbound (External Agent Calls Our API)

```
1. External agent sends POST /message
   Headers: x-agentkit-proof: <signed proof>
   Body: { agentId: "...", message: "..." }

2. Express shared-secret middleware
   -> No x-shared-secret header -> continue to AgentKit middleware

3. AgentKit middleware
   -> Extract proof from x-agentkit-proof
   -> agentBook.verify(proof) -> humanId
   -> Check nonce not replayed
   -> Record nonce
   -> Check agentkit_usage(endpoint="/message", humanId) < 3
   -> Increment usage
   -> next()

4. Existing /message handler processes normally
```

## Data Flow: Outbound (Our Agent Calls External AgentKit API)

```
1. Agent container makes HTTP request to external service
   -> Detects 402 response with AgentKit extension

2. Container calls POST http://host.docker.internal:3001/agentkit/sign
   Headers: X-Agent-Id: <agentId>
   Body: { url: "https://external.service/data", method: "GET" }

3. Credential proxy:
   -> Recover agent private key from Supabase
   -> Sign proof using @worldcoin/agentkit SDK
   -> Return { proof: "<signed proof>" }

4. Container retries request with x-agentkit-proof header
   -> External service verifies and allows access
```

## Error Handling

| Scenario | Behavior |
|---|---|
| AgentBook verification fails | 401 with `{ error: "invalid_proof", message: "AgentKit proof verification failed" }` |
| Nonce already used | 401 with `{ error: "nonce_replayed", message: "This proof has already been used" }` |
| Free-trial exhausted | 402 with x402 payment options |
| Agent not registered in AgentBook | `/agentkit/sign` returns 400 with registration instructions |
| Supabase down | Log error, fail open for owner requests, fail closed for external |

## Testing Plan

1. **Unit tests**: AgentKit middleware with mocked AgentBook verifier
2. **Integration test**: Full flow from external request through middleware to message delivery
3. **Owner bypass test**: Verify shared-secret requests skip AgentKit entirely
4. **Free-trial exhaustion test**: Verify 402 after N uses
5. **Nonce replay test**: Verify same proof rejected twice
6. **Credential proxy test**: Verify `/agentkit/sign` returns valid proofs
7. **Container env test**: Verify AGENTKIT_* vars are injected into spawned containers

## Implementation Order

1. Supabase migration (database tables)
2. AgentKit storage adapter (Supabase implementation of AgentKitStorage interface)
3. AgentKit middleware (inbound protection)
4. Wire middleware into webapp channel (apply to /message, skip /stream, /register-group)
5. Credential proxy extension (/agentkit/sign route)
6. Container env injection (AGENTKIT_ENABLED, AGENTKIT_SIGN_URL)
7. Update .env.example with new config vars
8. Documentation in README
