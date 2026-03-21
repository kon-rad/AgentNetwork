# Stack Research

**Domain:** AI agent social marketplace — v2.0 milestone additions (Supabase, SIWE, NanoClaw, observability, CI/CD)
**Researched:** 2026-03-22
**Confidence:** MEDIUM-HIGH (Supabase/SIWE HIGH; NanoClaw HTTP channel LOW — no existing implementation found)

---

## Context: What We're Adding

This file covers only the **new v2.0 additions**. The existing v1.0 stack (RainbowKit, wagmi v2, viem, ERC-8004, Clanker, x402, Self Protocol, Filecoin) is documented in the prior STACK.md section above and is **not repeated here**.

Existing confirmed versions (do not change):
- Next.js 16.2.0, React 19.2.4, TypeScript 5
- wagmi ^2.19.5, viem ^2.47.5, @tanstack/react-query ^5.91.2
- @rainbow-me/rainbowkit ^2.2.10
- tailwindcss ^4, zustand ^5

**Critical constraint inherited from v1.0:** Do NOT upgrade wagmi to v3. RainbowKit 2.x is pinned to wagmi ^2.x.

---

## Recommended Stack — New Additions Only

### 1. Database: Supabase (replacing SQLite)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` | ^2.99.3 | Postgres client, Realtime, Auth | Current stable; 2.x API is stable; Realtime subscriptions built in; single package covers all server/client use cases |
| `@supabase/ssr` | ^0.8.1 | Cookie-based session helpers for Next.js App Router | Replaces deprecated `@supabase/auth-helpers-nextjs`; provides `createServerClient` and `createBrowserClient` with cookie management; v0.8.1 is latest stable (RC at v0.10.0) |

**Confidence:** HIGH — supabase-js v2.99.3 verified from npm (March 2026). @supabase/ssr v0.8.1 verified from GitHub releases.

**Why Supabase over keeping SQLite:**
- Railway and VPS both need read/write access to the same database — SQLite is single-process only
- Supabase Realtime eliminates a custom SSE pipeline for the observability dashboard
- Row Level Security enforces agent ownership at the database layer
- Free tier (500MB, 50K MAU) sufficient for hackathon; upgrade path is seamless

**Setup pattern for Next.js App Router:**
```typescript
// lib/supabase/server.ts — server components, route handlers, server actions
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), ... } }
  )
}

// lib/supabase/admin.ts — server ONLY, never client bundle
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
export const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // bypasses RLS — keep server-only
)
```

**CRITICAL:** The `SUPABASE_SERVICE_ROLE_KEY` (service role) bypasses all RLS policies. It must NEVER appear in client bundles or `NEXT_PUBLIC_*` env vars. Only import from server-only files.

**Realtime subscription pattern (browser):**
```typescript
const channel = supabase
  .channel('agent-events')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'agent_events',
    filter: `agent_id=eq.${agentId}`
  }, (payload) => handleEvent(payload.new))
  .subscribe()
```

Note: Realtime for Postgres changes is **disabled by default** on new Supabase projects. Must be explicitly enabled via the Supabase dashboard → Database → Replication.

---

### 2. Authentication: SIWE (Sign-In With Ethereum) + iron-session

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `siwe` | ^3.0.0 | EIP-4361 message construction and verification | Official SpruceID library; v3.0.0 removes `validate()` in favor of `verify()`, drops `uri-js`/`valid-url` deps; aligns with current EIP-4361 spec |
| `iron-session` | ^8.0.1 | Encrypted, stateless, cookie-based session storage | v8 is built for Next.js App Router; `getIronSession(cookies(), config)` works in Server Components, Route Handlers, and Server Actions; no database required for session state |

**Confidence:** HIGH — siwe v3.0.0 verified from GitHub releases (January 2026). iron-session v8.0.1 verified from GitHub releases.

**Why not NextAuth for SIWE:**
- NextAuth adds complexity for wallet-only auth (no email/password needed)
- SIWE + iron-session is the minimal pattern recommended in wagmi docs and SpruceID blog
- iron-session sessions are stateless (encrypted cookie) — no session table in Supabase needed
- Agent ownership can be stored directly in the session: `{ address, chainId, agentIds[] }`

**Why not Reown AppKit (formerly WalletConnect) SIWE:**
- AppKit SIWE requires their hosted backend; adds external dependency
- We already have RainbowKit for wallet connection — SIWE can be added directly on top

**Auth flow:**
```
1. User connects wallet (RainbowKit — already in stack)
2. Frontend: wagmi useSignMessage → signs SIWE message (EIP-4361)
3. POST /api/auth/verify → siwe.verify() on server → getIronSession() → store { address }
4. Subsequent requests: iron-session reads cookie → validates address
5. Agent ownership tied to address stored in session
```

**SIWE message construction uses wagmi's `useSignMessage` hook (already in stack) — no additional wallet hooks needed.**

---

### 3. Agent Runtime: NanoClaw Fork

**NanoClaw:** github.com/qwibitai/nanoclaw (~24K GitHub stars, ~1500 LOC TypeScript)

**Architecture (upstream):**
- Single Node.js process
- Polling loop: SQLite every 2 seconds → container invocation
- Channels self-register at startup via `registerChannel(name, factory)`
- Channel interface requires: `connect()`, `sendMessage()`, `isConnected()`, plus `onMessage` callback
- Credential proxy exposes a local port for Claude API calls from containers
- IPC is file-based (not HTTP) between containers and host

**The critical finding: NanoClaw has NO HTTP channel upstream.** All upstream channels (WhatsApp, Telegram, Discord, Slack, Gmail) are messaging-platform-specific. There is no webhook or HTTP inbound channel in the current codebase.

**What this means for the fork:**

We must implement a custom HTTP channel as a new skill branch (`skill/webapp-channel`). The channel must:

1. Start an Express/Fastify HTTP server inside NanoClaw
2. Accept `POST /message` with `{ agentId, message, sessionToken }` from Next.js
3. Write to NanoClaw's SQLite as a new message for the target group
4. Return SSE stream or polling endpoint for responses

**NanoClaw fork additions required:**
```
src/channels/webapp/
  index.ts        — HTTP server, self-registers via registerChannel()
  handler.ts      — validates shared secret header, writes to SQLite
src/config.ts     — add WEBAPP_PORT, WEBAPP_SHARED_SECRET env vars
```

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `express` | ^5.1.0 OR `fastify` | HTTP server inside NanoClaw fork | Express 5.x is stable; adds <5 LOC to fork; fits NanoClaw's "small enough to understand" philosophy |
| NanoClaw fork (TypeScript) | main branch clone | Agent container orchestration | Existing container isolation, credential proxy, session persistence — building from scratch would be 10x the work |

**Confidence:** MEDIUM — NanoClaw architecture verified from source; HTTP channel feasibility is MEDIUM (channel interface is documented, implementation is custom work).

**NanoClaw does NOT need to be an npm package.** It lives in `agent-server/` subdirectory of the monorepo as a TypeScript project with its own `package.json`.

---

### 4. Secure Communication: WireGuard Tunnel

WireGuard is a kernel-level VPN built into Linux 5.6+ (2020). No library is needed — it is configured via system tools.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `wireguard-tools` (system) | kernel built-in + userspace tools | Encrypted tunnel between Railway and VPS | WireGuard is the simplest modern VPN; kernel-native on Ubuntu 22.04 (VPS); 25x faster than OpenVPN; single config file per peer |
| Shared secret header | N/A | Per-request authentication on top of WireGuard | Defense-in-depth: WireGuard encrypts transit, shared secret validates caller identity at application layer |

**Confidence:** MEDIUM — WireGuard is well-established; Railway-specific configuration (whether outbound WireGuard peers can be configured from Railway side) needs verification.

**Railway constraint:** Railway only exposes a single HTTP port per service. Outbound connections (Railway → VPS over WireGuard) should work since Railway containers can make outbound TCP/UDP connections. However, Railway does NOT support incoming UDP (WireGuard default port 51820). This means Railway must initiate the WireGuard peer connection to the VPS, not vice versa.

**Recommended pattern:**
- VPS: WireGuard server on `10.0.0.1`, listens on UDP 51820 (exposed via VPS firewall)
- Railway: WireGuard client in Next.js container, connects out to VPS on startup
- NanoClaw binds HTTP channel only on `10.0.0.2` (WireGuard interface) — never on public interface
- Next.js calls `http://10.0.0.2:PORT/message` — traffic stays encrypted inside tunnel

**Alternative if WireGuard on Railway is blocked:** Use a shared secret header over HTTPS with NanoClaw exposed via a Caddy reverse proxy on VPS. Less ideal (public IP exposure) but functional.

---

### 5. USDC Subscription Payments (50 USDC on Base)

No new packages required. Uses existing `wagmi` + `viem` stack.

**USDC contract address on Base mainnet:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (verified via Circle docs + BaseScan)
**USDC decimals:** 6 (50 USDC = `50_000_000n` in BigInt)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `wagmi` `useWriteContract` hook | existing ^2.x | Trigger USDC `transfer()` from user wallet | Already in stack; `useWriteContract` handles ERC-20 calls; `useSimulateContract` validates before signing |
| `viem` `erc20Abi` | existing ^2.x | ABI for USDC token interactions | Built into viem; no separate ABI file needed for standard ERC-20 |

**Payment flow:**
```
1. User calls USDC.transfer(PLATFORM_TREASURY, 50_000_000n) via wagmi useWriteContract
2. Next.js API: verify tx hash on-chain using viem publicClient.getTransactionReceipt()
3. Confirm: to=USDC_CONTRACT, from=user, decoded transfer.to=TREASURY, amount>=50 USDC
4. Write to Supabase: subscriptions table { owner_address, agent_template_id, tx_hash, activated_at }
```

**Why `transfer()` not `approve()` + `transferFrom()`:**
- Direct `transfer()` is simpler — user sends directly to treasury
- No contract intermediary needed for 50 USDC subscription
- `approve()` + `transferFrom()` only needed if a smart contract needs to pull funds

**Note:** 50 USDC = `50_000_000n` (6 decimals). Verify with `formatUnits(amount, 6)` before display.

---

### 6. Agent Observability Dashboard: Supabase Realtime

Covered by `@supabase/supabase-js` already listed above. No additional packages needed.

**Schema addition — `agent_events` table:**
```sql
create table agent_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id),
  event_type text not null,  -- 'tool_call' | 'llm_response' | 'token_usage' | 'error'
  payload jsonb,
  created_at timestamptz default now()
);

-- Required for Realtime to include old values on UPDATE/DELETE
alter table agent_events replica identity full;

-- RLS: only owner can see their agent's events
alter table agent_events enable row level security;
create policy "owner can read events"
  on agent_events for select
  using (
    agent_id in (
      select id from agents where owner_address = current_setting('request.jwt.claims', true)::jsonb->>'address'
    )
  );
```

**NanoClaw writes events:** Inside the forked NanoClaw container runner, after each tool call / LLM response, write a row to `agent_events` via Supabase JS client (using service role key — containers have access to it via credential proxy or direct env var).

**Browser subscribes:** Dashboard page subscribes to `postgres_changes` on `agent_events` filtered by `agent_id`. Updates render in real-time without polling.

**Realtime must be enabled in Supabase dashboard** for the `agent_events` table.

---

### 7. CI/CD: Monorepo Pipeline (Railway + VPS)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| GitHub Actions | N/A | CI orchestration | Free for public repos; Railway supports `deployment_status` event hooks; path filters avoid unnecessary builds |
| Railway monorepo | N/A | Deploy `app/` subdirectory to Railway | Railway has native monorepo support with `Root Directory` + watch paths; auto-detects pnpm workspaces |
| `appleboy/ssh-action` | v1.2.4 | Deploy `agent-server/` to VPS via SSH | Most-used SSH action (130K+ repos); v1.2.4 stable as of 2026; supports SSH key auth |

**Monorepo structure:**
```
/
├── app/                    # Next.js (deploys to Railway)
│   ├── src/
│   ├── package.json
│   └── railway.json
├── agent-server/           # NanoClaw fork (deploys to VPS)
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── packages/
│   └── shared-types/       # Shared TypeScript types (optional)
├── .github/
│   └── workflows/
│       ├── deploy-app.yml          # Triggers Railway deploy on app/ changes
│       └── deploy-agent-server.yml # SSH to VPS on agent-server/ changes
└── package.json            # Root pnpm workspace
```

**GitHub Actions path filtering (prevents redundant deploys):**
```yaml
# deploy-app.yml
on:
  push:
    branches: [main]
    paths: ['app/**', 'packages/**']

# deploy-agent-server.yml
on:
  push:
    branches: [main]
    paths: ['agent-server/**', 'packages/**']
```

**VPS deploy workflow:**
```yaml
- uses: appleboy/ssh-action@v1.2.4
  with:
    host: ${{ secrets.VPS_HOST }}
    username: ${{ secrets.VPS_USER }}
    key: ${{ secrets.VPS_SSH_KEY }}
    script: |
      cd /opt/agent-server
      git pull origin main
      pnpm install --frozen-lockfile
      docker build -t nanoclaw:latest .
      docker compose up -d --force-recreate
```

**Railway deploy:** Railway auto-deploys from GitHub on `main` push. Set Root Directory to `/app` in Railway service settings. Watch paths filter to `app/**` changes only.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated — replaced by `@supabase/ssr` | `@supabase/ssr` ^0.8.1 |
| NextAuth for SIWE | Adds unnecessary complexity; SIWE + iron-session is the canonical minimal pattern | `siwe` + `iron-session` |
| `next-iron-session` | Deprecated predecessor to `iron-session` v7+; API is different | `iron-session` ^8.x |
| Building a custom agent server from scratch | NanoClaw provides container isolation, credential proxy, session persistence — ~1500 LOC already written | Fork NanoClaw, add HTTP channel skill |
| Storing session state in Supabase | iron-session is stateless (encrypted cookie) — adding a sessions table adds complexity without benefit | `iron-session` stateless cookies |
| `web3.js` or `ethers.js` for USDC payments | Already have viem in stack; mixing Ethereum libraries causes type conflicts | `viem` `erc20Abi` + `wagmi` `useWriteContract` |
| Redis for real-time events | Supabase Realtime directly streams Postgres WAL changes to browsers — no message broker needed | Supabase Realtime `postgres_changes` |
| OpenVPN or WireGuard hosted services (Tailscale etc.) | Self-managed WireGuard is simpler and free; Tailscale adds a third-party dependency in the critical path | Self-managed WireGuard on VPS |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `siwe` + `iron-session` | Reown AppKit SIWE | If you need WalletConnect-hosted backend, social login fallback, or enterprise session management |
| Supabase Realtime | Custom SSE endpoint from Next.js | If Supabase Realtime latency is too high (it uses WebSocket, ~100-300ms); SSE gives more control |
| Supabase Realtime | Pusher / Ably | If you need broadcast to thousands of concurrent users; Supabase Realtime has a 200 concurrent connection limit on free tier |
| `appleboy/ssh-action` for VPS deploy | Self-hosted GitHub runner on VPS | If deploys are frequent (>50/day) and GitHub Actions minutes are constrained; adds setup complexity |
| NanoClaw fork + HTTP channel | Custom agent server (TypeScript from scratch) | Only if NanoClaw's container-per-turn model proves incompatible with streaming SSE responses |
| Direct USDC `transfer()` | Smart contract subscription manager | If you need on-chain enforcement, recurring payments, or refund logic |

---

## Version Compatibility Matrix

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `@supabase/supabase-js@^2.99.3` | Next.js 16, Node.js 18+, React 19 | v2.x API is stable; do not use v1.x (removed) |
| `@supabase/ssr@^0.8.1` | `@supabase/supabase-js@^2`, Next.js 13+ App Router | Peer dep: supabase-js ^2; requires Next.js `cookies()` from `next/headers` |
| `siwe@^3.0.0` | viem 2.x (for address utilities), wagmi 2.x | siwe v3 removes ethers.js dependency; works standalone |
| `iron-session@^8.0.1` | Next.js App Router (Route Handlers, Server Components, Server Actions) | `getIronSession(cookies(), config)` — cookie param changed from v7 |
| `wagmi@^2.19.5` (existing) | siwe@^3, viem@^2.47.5 | No version change needed; siwe uses wagmi's `useSignMessage` |
| `viem@^2.47.5` (existing) | erc20Abi for USDC, SIWE utilities | `verifyMessage` from viem can replace ethers in siwe verify flow |

---

## Installation Commands (New Packages Only)

```bash
# Supabase (client + SSR helpers)
pnpm add @supabase/supabase-js @supabase/ssr

# SIWE auth + session
pnpm add siwe iron-session

# NanoClaw fork: add to agent-server/
# (clone and add HTTP channel skill — no npm install for NanoClaw itself)
# Inside agent-server/, add Express for HTTP channel:
pnpm add express
pnpm add -D @types/express
```

No additional packages needed for: USDC payments (uses existing viem/wagmi), Supabase Realtime (uses existing @supabase/supabase-js), CI/CD (GitHub Actions YAML + appleboy/ssh-action from marketplace).

---

## Open Research Items (Verify Before Building)

1. **WireGuard on Railway:** Railway containers run on shared infrastructure. Verify whether outbound WireGuard (UDP) connections are allowed from Railway containers. If blocked, fall back to HTTPS + shared secret header with NanoClaw on a public HTTPS endpoint (Caddy on VPS). Flag as HIGH priority to validate in Phase 1.

2. **NanoClaw HTTP channel implementation:** No upstream HTTP channel exists. The fork implementation is greenfield work. Verify that NanoClaw's polling loop (2-second SQLite poll) is compatible with low-latency chat UX. May need to reduce `POLL_INTERVAL` or add a direct invocation path.

3. **Supabase Realtime concurrent connection limit:** Free tier = 200 concurrent WebSocket connections. Verify this is sufficient for hackathon demo. If dashboard is open in multiple browser tabs, each tab uses one connection.

4. **supabase-js and @supabase/ssr version alignment:** The `@supabase/ssr` package is still in release candidate (v0.10.0-rc.75 as of March 2026). Use v0.8.1 (latest stable) and monitor for v0.10.0 stable before production.

5. **SIWE message nonce management:** Each SIWE message requires a unique nonce to prevent replay attacks. Nonces must be server-generated and stored (even briefly). With iron-session (stateless), nonces can be stored in a short-lived Supabase row OR in the session cookie itself. Decision needed before auth implementation.

---

## Sources

- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.99.3 confirmed — HIGH confidence
- [@supabase/ssr GitHub releases](https://github.com/supabase/ssr/releases) — v0.8.1 stable confirmed — HIGH confidence
- [Supabase Realtime Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription API verified — HIGH confidence
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS patterns verified — HIGH confidence
- [siwe GitHub releases](https://github.com/spruceid/siwe/releases) — v3.0.0 confirmed January 2026 — HIGH confidence
- [iron-session GitHub releases](https://github.com/vvo/iron-session/releases) — v8.0.1 confirmed — HIGH confidence
- [wagmi SIWE example](https://1.x.wagmi.sh/examples/sign-in-with-ethereum) — integration pattern — MEDIUM confidence
- [NanoClaw GitHub](https://github.com/qwibitai/nanoclaw) — architecture and channel interface verified — HIGH confidence
- [NanoClaw DeepWiki](https://deepwiki.com/openclaw-shi/nanoclaw) — polling architecture, SQLite model — MEDIUM confidence
- [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) — Base mainnet 0x833589... confirmed — HIGH confidence
- [Railway monorepo docs](https://docs.railway.com/guides/monorepo) — watch paths, root directory pattern — HIGH confidence
- [appleboy/ssh-action GitHub](https://github.com/appleboy/ssh-action) — v1.2.4 confirmed — HIGH confidence
- [wagmi useWriteContract docs](https://wagmi.sh/react/api/hooks/useWriteContract) — ERC-20 write pattern — HIGH confidence
- [WireGuard VPS tunnel guides](https://diymediaserver.com/post/2026/install-wireguard-vps-homelab-tunnel/) — tunnel pattern — MEDIUM confidence (Railway UDP constraint unverified)

---

*Stack research for: v2.0 agent subscriptions, Supabase migration, SIWE auth, NanoClaw fork, observability*
*Researched: 2026-03-22*
