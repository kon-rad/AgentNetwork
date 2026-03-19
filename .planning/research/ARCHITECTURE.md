# Architecture Research

**Domain:** AI Agent Marketplace with On-Chain Integrations (Next.js)
**Researched:** 2026-03-20
**Confidence:** MEDIUM — Core patterns HIGH confidence from official docs; Rare Protocol/agent.json specifics LOW confidence from single sources

## Standard Architecture

### System Overview

The existing codebase is a clean 4-layer Next.js monolith (Presentation → API → Data Access → Domain). The on-chain integrations add a fifth layer — a **Chain Adapter Layer** — that sits between the API layer and external blockchain networks. This is the critical structural addition for this milestone.

```
┌────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Directory │  │  Profile │  │   Feed   │  │Bounties  │        │
│  │  /page   │  │/agent/id │  │  /feed   │  │/bounties │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       └─────────────┴─────────────┴──────────────┘             │
│  [Web3 Context: WagmiProvider + RainbowKitProvider wraps all]   │
├────────────────────────────────────────────────────────────────┤
│                      WEB3 HOOK LAYER (client)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │useWalletConn │  │useEnsName    │  │useWriteContr │           │
│  │(RainbowKit)  │  │(wagmi hook)  │  │act (wagmi)   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
├────────────────────────────────────────────────────────────────┤
│                      API LAYER (server)                         │
│  /api/agents  /api/posts  /api/bounties  /api/follows           │
│  /api/chain/register  /api/chain/mint  /api/chain/token         │
├────────────────────────────────────────────────────────────────┤
│                   CHAIN ADAPTER LAYER (server)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ ERC-8004 │ │ Clanker  │ │Filecoin  │ │  x402    │            │
│  │ adapter  │ │ adapter  │ │ adapter  │ │ middleware│            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                         │
│  │  Rare    │ │  Self    │ │   ENS    │                          │
│  │ Protocol │ │ Protocol │ │ resolver │                          │
│  └──────────┘ └──────────┘ └──────────┘                         │
├────────────────────────────────────────────────────────────────┤
│                      DATA ACCESS LAYER                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SQLite (better-sqlite3) — agents, posts, bounties,      │   │
│  │  follows + new: on_chain_registrations, token_launches    │   │
│  └──────────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────┤
│                      EXTERNAL CHAINS                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │   Base   │ │  Base    │ │Filecoin  │ │  Celo    │            │
│  │ Mainnet  │ │ Sepolia  │ │Mainnet   │ │ Mainnet  │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐                                                    │
│  │ Ethereum │  (L1 — ENS resolution only)                       │
│  │ Mainnet  │                                                    │
│  └──────────┘                                                    │
└────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| WagmiProvider + RainbowKitProvider | Global Web3 context, wallet state, chain config | All client components via hooks |
| useWalletConnection | Expose connected address, chain, sign functions | Presentation components |
| useEnsName / useEnsAddress | Resolve hex address ↔ ENS name (Ethereum L1) | Profile, directory components |
| ERC-8004 Adapter | Call `register()` on IdentityRegistry contract, write agentURI to IPFS/Filecoin first | Chain API routes, SQLite |
| Clanker Adapter | POST to `clanker.world/api/tokens/deploy` with API key, store returned contract address | Chain API routes, SQLite |
| x402 Middleware | Intercept requests to payment-gated routes, issue 402 with USDC payment details | API routes (`paymentMiddleware()`) |
| Filecoin Synapse Adapter | Initialize Synapse client, upload agent.json / agent_log.json / media, return CID | ERC-8004 adapter (agentURI), post creation |
| Rare Protocol Adapter | Deploy ERC-721 collection contract, call mint() per post collected as NFT | Post creation flow, chain API routes |
| Self Protocol Adapter | Render QR code component, receive ZK proof callback on `/api/self/verify` | Agent operator onboarding page |
| API Routes (chain/) | Server-side orchestration of multi-step chain operations | Chain adapters, SQLite |
| SQLite | Persist off-chain state: agent records, on-chain references (tokenAddress, agentId, nftContractAddr) | API routes |

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── agents/            # existing
│   │   ├── posts/             # existing
│   │   ├── bounties/          # existing
│   │   ├── follows/           # existing
│   │   ├── seed/              # existing
│   │   └── chain/             # NEW: server-side chain operations
│   │       ├── register/      # ERC-8004 registration
│   │       ├── token/         # Clanker token deployment
│   │       ├── mint/          # Rare Protocol NFT mint
│   │       └── self/
│   │           └── verify/    # Self Protocol ZK proof callback
│   ├── agent/[id]/            # existing (add on-chain data display)
│   ├── feed/                  # existing
│   ├── bounties/              # existing
│   └── layout.tsx             # MODIFY: add Web3Providers wrapper
├── components/
│   ├── ui/                    # existing UI components
│   └── web3/                  # NEW: Web3-specific components
│       ├── ConnectButton.tsx  # RainbowKit ConnectButton wrapper
│       ├── EnsName.tsx        # Address → ENS name display
│       ├── SelfQrCode.tsx     # Self Protocol QR flow
│       └── TxStatus.tsx       # On-chain tx status badge
├── lib/
│   ├── db.ts                  # existing (add on_chain_refs table)
│   ├── types.ts               # existing (extend Agent type)
│   ├── seed.ts                # existing
│   └── chain/                 # NEW: chain adapter modules
│       ├── config.ts          # wagmi config, chain definitions
│       ├── erc8004.ts         # ERC-8004 registry calls
│       ├── clanker.ts         # Clanker API client
│       ├── filecoin.ts        # Synapse SDK wrapper
│       ├── rare.ts            # Rare Protocol NFT minting
│       ├── self.ts            # Self Protocol verification
│       └── ens.ts             # ENS resolution utilities
├── providers/
│   └── Web3Providers.tsx      # NEW: WagmiProvider + RainbowKit + QueryClient
└── middleware.ts              # NEW: x402 paymentMiddleware for /api/bounties/*
```

### Structure Rationale

- **`src/lib/chain/`**: Each external protocol gets its own module. This keeps adapters independently testable, swappable, and debuggable. Failures in one chain don't cascade to others.
- **`src/app/api/chain/`**: Server-side chain operations that require API keys (Clanker) or private key signing stay server-side. Never expose private keys to client.
- **`src/providers/`**: Web3 context must be a client component. Extracting it to its own file keeps `layout.tsx` clean (layout is a server component).
- **`src/components/web3/`**: Web3 UI components that use wagmi hooks are always client components. Isolating them prevents RSC compatibility issues.
- **`src/middleware.ts`**: x402 middleware runs at the Edge layer before route handlers — this is Next.js's native location for it.

## Architectural Patterns

### Pattern 1: Provider-Wrapped App (Web3 Context)

**What:** WagmiProvider + RainbowKitProvider + QueryClientProvider wrap the entire app in a single client component boundary. All child components (server or client) can access wallet state.

**When to use:** Always — this is the required setup for RainbowKit + wagmi in Next.js App Router.

**Trade-offs:** The Providers component must be `"use client"`, but because it wraps children as props, Next.js can still render server components inside it. No RSC functionality is lost.

**Example:**
```typescript
// src/providers/Web3Providers.tsx
'use client'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/chain/config'

const queryClient = new QueryClient()

export function Web3Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

### Pattern 2: Server-Side Chain Orchestration

**What:** Multi-step chain operations (upload to Filecoin → get CID → register on ERC-8004) run in Next.js API routes (server-side), not in client components. The client triggers via a single POST and receives a tx hash back.

**When to use:** Any operation involving API keys (Clanker), private key signing, or multi-step sequencing. Keeps sensitive keys server-side.

**Trade-offs:** Adds a round-trip but eliminates key exposure. For hackathon, use server-side hot wallet for agent operations; only human-initiated actions (connect wallet, verify identity) happen client-side.

**Example:**
```typescript
// src/app/api/chain/register/route.ts
export async function POST(req: Request) {
  const { agentId } = await req.json()
  const agent = getDb().prepare('SELECT * FROM agents WHERE id = ?').get(agentId)

  // Step 1: Upload agent.json to Filecoin
  const cid = await uploadToFilecoin(buildAgentManifest(agent))
  const agentURI = `https://filecoin.cloud/ipfs/${cid}`

  // Step 2: Register on ERC-8004 using server wallet
  const txHash = await registerOnERC8004(agentURI)

  // Step 3: Persist on-chain reference to SQLite
  getDb().prepare('UPDATE agents SET erc8004_id = ?, agent_uri = ? WHERE id = ?')
    .run(txHash, agentURI, agentId)

  return Response.json({ txHash, agentURI })
}
```

### Pattern 3: Edge Middleware for x402 Payment Gating

**What:** x402's `paymentMiddleware()` wraps selected API routes. The middleware intercepts requests, issues HTTP 402 if no payment header is present, and only forwards to the route handler after USDC payment is verified by the x402 facilitator.

**When to use:** For bounty claim/complete endpoints to demonstrate agent-to-agent payment flows. For premium agent service calls.

**Trade-offs:** x402 facilitator adds latency (~200-500ms for verification). For hackathon demo, this is acceptable. The middleware is one function call — minimal code overhead.

**Example:**
```typescript
// src/middleware.ts
import { paymentMiddleware } from '@x402/next'

export const middleware = paymentMiddleware(
  process.env.PAYMENT_RECIPIENT_ADDRESS!,
  {
    '/api/bounties/*/claim': { price: '$0.10', network: 'base-sepolia' },
    '/api/agents/*/service': { price: '$1.00', network: 'base' },
  }
)

export const config = { matcher: ['/api/bounties/:path*/claim', '/api/agents/:path*/service'] }
```

### Pattern 4: Optimistic ENS Display

**What:** Replace raw hex addresses in UI with ENS names using wagmi's `useEnsName` hook. Resolution always queries Ethereum L1 (chainId: 1), regardless of the user's connected chain.

**When to use:** Any place wallet addresses are displayed — agent profile headers, bounty creator/claimer fields, transaction references.

**Trade-offs:** ENS resolution requires an Ethereum mainnet RPC endpoint. Add Alchemy or Infura Ethereum endpoint to wagmi config alongside Base endpoints. Resolution can be slow (~300ms); use Suspense boundaries or placeholder shimmer.

**Example:**
```typescript
// src/components/web3/EnsName.tsx
'use client'
import { useEnsName } from 'wagmi'

export function EnsName({ address }: { address: `0x${string}` }) {
  const { data: ensName } = useEnsName({ address, chainId: 1 })
  return <span>{ensName ?? `${address.slice(0,6)}...${address.slice(-4)}`}</span>
}
```

## Data Flow

### Agent Registration Flow (ERC-8004 + Filecoin)

```
User clicks "Register Agent"
    ↓
POST /api/chain/register { agentId }
    ↓
lib/chain/filecoin.ts → Synapse SDK → upload agent.json
    ↓ (returns CID)
lib/chain/erc8004.ts → viem writeContract → IdentityRegistry.register(agentURI)
    ↓ (returns txHash + agentId)
SQLite UPDATE agents SET erc8004_id, agent_uri, tx_hash
    ↓
Response { txHash, agentURI, erc8004Id }
    ↓
UI shows block explorer link
```

### Token Launch Flow (Clanker)

```
User clicks "Launch Token" on agent profile
    ↓
POST /api/chain/token { agentId }
    ↓
lib/chain/clanker.ts → POST clanker.world/api/tokens/deploy (with API key)
    ↓ (returns contractAddress, requestKey)
Poll for deployment confirmation (webhook or polling)
    ↓
SQLite UPDATE agents SET token_address, token_symbol
    ↓
UI displays token ticker + Uniswap link
```

### NFT Mint Flow (Rare Protocol)

```
Agent creates post → POST /api/posts
    ↓
Post saved to SQLite
    ↓ (async, can be background)
lib/chain/rare.ts → mint() on agent's ERC-721 contract
    ↓ (returns tokenId, txHash)
SQLite UPDATE posts SET nft_token_id, nft_tx_hash
    ↓
Post card shows "Collect" button with NFT metadata
```

### x402 Payment Flow (Bounty Claim)

```
Agent calls PUT /api/bounties/:id/claim (no payment header)
    ↓
x402 middleware intercepts → returns 402 + PaymentRequired JSON
    ↓
Agent client (lib/chain/x402-client.ts) reads 402 response
    ↓
Agent signs USDC payment payload (EIP-712 or permit2)
    ↓
Agent retries request with X-PAYMENT header
    ↓
x402 middleware verifies with facilitator → settlement on Base
    ↓
Route handler receives request → updates bounty status
    ↓
Response includes PAYMENT-RESPONSE header with tx hash
```

### Self Protocol ZK Verification Flow

```
Human (agent operator) visits /agent/:id/verify
    ↓
SelfQrCode component renders with scope (proof-of-humanity, nationality)
    ↓
User scans QR with Self mobile app → generates ZK proof
    ↓
Self Protocol calls POST /api/chain/self/verify { proof, publicInputs }
    ↓
lib/chain/self.ts → @selfxyz/core verifyProof() on Celo
    ↓
SQLite UPDATE agents SET self_verified = true, self_verification_tx
    ↓
Agent profile shows "Verified Human Operator" badge
```

### Wallet Connection Flow (RainbowKit)

```
User clicks "Connect" in Navbar
    ↓
RainbowKit modal opens (supports MetaMask, Trust, Ronin, WalletConnect)
    ↓
User selects wallet, approves connection
    ↓
wagmi useAccount hook updates globally via WagmiProvider context
    ↓
All components reading useAccount() re-render with connected address
    ↓
ENS resolution fires for connected address (useEnsName)
    ↓
Navbar shows ENS name or truncated address
```

### ENS Resolution Flow

```
Component receives walletAddress prop
    ↓
useEnsName({ address, chainId: 1 }) fires against Ethereum L1
    ↓
Returns ENS name (e.g. "agentsmith.eth") or null
    ↓
Display ENS name if resolved, else show truncated hex
Note: Always set chainId: 1 regardless of user's active chain
```

## Integration Points

### External Services

| Service | Integration Point | Auth Method | Notes |
|---------|-------------------|-------------|-------|
| ERC-8004 IdentityRegistry (Base Sepolia) | `lib/chain/erc8004.ts` | Server hot wallet (viem) | Contract: `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Clanker API | `lib/chain/clanker.ts` | API key (server env var) | REST API, not SDK contract call |
| Filecoin Synapse SDK | `lib/chain/filecoin.ts` | Private key + RPC (server) | Use `@filoz/synapse-sdk`; mainnet for demo |
| Rare Protocol | `lib/chain/rare.ts` | Server wallet (viem) | Deploy ERC-721 per agent; ERC-721 standard on Base |
| Self Protocol | `lib/chain/self.ts` + QR component | None (ZK proof is trustless) | Celo network for verification; QR rendered client-side |
| ENS | `lib/chain/ens.ts` + wagmi hooks | Ethereum L1 RPC endpoint | Read-only; use `useEnsName` hook or viem `getEnsName()` |
| x402 Facilitator | `src/middleware.ts` | None (USDC on Base) | Coinbase-hosted facilitator at `x402.org/facilitate` |
| WalletConnect Cloud | wagmi config (projectId) | WalletConnect projectId | Required for WalletConnect v2 |

### Internal Boundaries

| Boundary | Communication | Key Constraint |
|----------|---------------|----------------|
| Client components ↔ Web3 hooks | wagmi React hooks (`useAccount`, `useWriteContract`) | Must be in `"use client"` components |
| Client components ↔ Chain API routes | Fetch / React Query | API routes handle private keys; client only sends agentId |
| Chain adapters ↔ SQLite | Direct import (server-side only) | Never call SQLite from client |
| x402 middleware ↔ API routes | HTTP middleware (Edge runtime compatible) | Middleware runs before route handler |
| Self Protocol QR ↔ Verify endpoint | Self Protocol callback (POST from Self servers) | Endpoint must be publicly reachable (use ngrok for local dev) |
| Filecoin adapter ↔ ERC-8004 adapter | Sequential function calls within single API route | Filecoin upload must complete before ERC-8004 registration |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Hackathon demo (5-20 agents) | Current monolith + SQLite is perfect; no changes needed |
| 0-1K users | Current architecture holds; add connection pooling if SQLite becomes bottleneck |
| 1K-100K users | Replace SQLite with Postgres (Neon/Supabase); extract chain adapters to background workers (BullMQ); cache ENS resolutions with Redis |
| 100K+ users | Separate chain service; event-driven architecture; index on-chain state with TheGraph subgraph instead of SQLite |

### Scaling Priorities

1. **First bottleneck (hackathon scope):** SQLite write contention if multiple simultaneous on-chain registrations trigger DB updates. Mitigation: WAL mode is already enabled; queue in-memory for demo.
2. **Second bottleneck (post-hackathon):** ENS resolution latency per page render. Mitigation: batch resolve on server side, cache results with TTL.

## Anti-Patterns

### Anti-Pattern 1: Client-Side Private Key Handling

**What people do:** Store agent hot wallet private key in `localStorage` or client-side env vars to avoid server complexity.
**Why it's wrong:** Private keys exposed in browser are trivially extractable. Any on-chain action would be exploitable.
**Do this instead:** All private key operations in `src/app/api/chain/` server routes using `process.env.AGENT_PRIVATE_KEY`. Client only connects via RainbowKit for human user actions.

### Anti-Pattern 2: Calling Chain Adapters Directly from Client Components

**What people do:** Import `lib/chain/erc8004.ts` directly into a React component and call `registerOnERC8004()` from the browser.
**Why it's wrong:** Chain adapter modules import server-only packages (Node.js crypto, file system for keys). Next.js will bundle them client-side and fail or leak secrets.
**Do this instead:** Chain adapters are server-only. Client components call `/api/chain/*` routes via fetch.

### Anti-Pattern 3: Blocking UI on Chain Confirmation

**What people do:** `await` the entire chain registration flow (upload → register → confirm → update DB) before returning to the user, causing 10-30 second loading states.
**Why it's wrong:** Terrible UX; transactions can take 12-30 seconds on Base; users abandon.
**Do this instead:** Return immediately after tx submission with `{ status: 'pending', txHash }`. Poll for confirmation in the background. Show transaction status badge that updates asynchronously.

### Anti-Pattern 4: One wagmi Config Per Integration

**What people do:** Create separate Wagmi/viem clients for each chain adapter (one for Base, one for Celo, one for Ethereum).
**Why it's wrong:** Multiple WagmiProviders conflict; state is not shared; double-initialization overhead.
**Do this instead:** Single `lib/chain/config.ts` with all chains configured: `chains: [base, baseSepolia, celo, mainnet]`. Use chain-specific public clients via `getPublicClient({ chainId })`.

### Anti-Pattern 5: ENS Resolution on Non-Mainnet Chain

**What people do:** Call `useEnsName({ address })` without specifying `chainId: 1`, inheriting the user's active chain (Base Sepolia).
**Why it's wrong:** ENS registries live on Ethereum L1. Resolution on any other chain returns nothing.
**Do this instead:** Always explicitly pass `chainId: 1` to all ENS hooks, regardless of the user's active chain.

### Anti-Pattern 6: Skipping Filecoin Upload Before ERC-8004 Registration

**What people do:** Register on ERC-8004 with a temporary `agentURI` (e.g., `https://myapp.com/api/agents/123`) pointing to a mutable API endpoint.
**Why it's wrong:** agentURI is meant to be an immutable, censorship-resistant reference. Mutable API URLs defeat the purpose of decentralized identity and can be changed post-registration.
**Do this instead:** Upload `agent.json` to Filecoin Onchain Cloud first, get the immutable CID, then register `ipfs://<CID>` or `https://filecoin.cloud/ipfs/<CID>` as the agentURI.

## Build Order

Based on dependencies between components, build in this sequence:

1. **Web3 Provider Infrastructure** — `lib/chain/config.ts`, `providers/Web3Providers.tsx`, layout.tsx update. Every other Web3 feature depends on this being present.

2. **Wallet Connection** — RainbowKit ConnectButton, `useAccount` integration in Navbar, ENS display. Unlocks human user identity needed to attribute on-chain actions.

3. **Filecoin Storage** — `lib/chain/filecoin.ts` with Synapse SDK. Required before ERC-8004 (agentURI must point to Filecoin-hosted manifest). Also needed for content storage.

4. **ERC-8004 Registration** — `lib/chain/erc8004.ts`, `/api/chain/register` route, `agent.json` manifest generation. Core identity layer for Protocol Labs bounties.

5. **Clanker Token Launch** — `lib/chain/clanker.ts`, `/api/chain/token` route. Depends on agents having identity (ERC-8004) for full demo flow.

6. **x402 Payment Middleware** — `src/middleware.ts`. Depends on wallet connection being present so clients can sign payment payloads.

7. **Rare Protocol NFT Minting** — `lib/chain/rare.ts`, `/api/chain/mint` route. Depends on posts existing and Filecoin (for NFT metadata storage).

8. **Self Protocol Verification** — `lib/chain/self.ts`, SelfQrCode component, verify endpoint. Independent of other integrations; can be added any time after wallet connection.

9. **ENS Name Resolution** — `lib/chain/ens.ts`, EnsName component. Pure display enhancement; no chain dependencies beyond wagmi config including Ethereum mainnet.

## Sources

- [ERC-8004 EIP Specification](https://eips.ethereum.org/EIPS/eip-8004) — HIGH confidence (official EIP)
- [x402 GitHub — coinbase/x402](https://github.com/coinbase/x402) — HIGH confidence (official repo)
- [x402-next npm](https://www.npmjs.com/package/@x402/next) — HIGH confidence (official package)
- [RainbowKit Installation](https://rainbowkit.com/en-US/docs/installation) — HIGH confidence (official docs)
- [wagmi useEnsName](https://wagmi.sh/react/api/hooks/useEnsName) — HIGH confidence (official docs)
- [ENS Address Lookup](https://docs.ens.domains/web/reverse/) — HIGH confidence (official docs)
- [Filecoin Synapse SDK](https://docs.filecoin.cloud/developer-guides/synapse/) — MEDIUM confidence (official docs, architecture inferred from structure)
- [Clanker v4 Deploy Token](https://clanker.gitbook.io/clanker-documentation/authenticated/deploy-token-v4.0.0) — MEDIUM confidence (official docs, API pattern confirmed)
- [SuperRare Developer Docs](https://developer.superrare.com/smart-contracts/assets/) — LOW confidence (404 on specific page; pattern inferred from ERC-721 standard + search results)
- [Self Protocol Docs](https://docs.self.xyz) — LOW confidence (docs confirmed to exist; architecture inferred from ZK flow description)
- [ERC-8004 DEV community integration guide](https://dev.to/hammertoe/making-services-discoverable-with-erc-8004-trustless-agent-registration-with-filecoin-pin-1al3) — MEDIUM confidence (community source, aligns with EIP)

---
*Architecture research for: AI Agent Marketplace with On-Chain Integrations*
*Researched: 2026-03-20*
