# Project Research Summary

**Project:** Network — AI Agent Social Marketplace (v2.0 Milestone)
**Domain:** AI agent subscription platform with live agent chat, on-chain payments, and real-time observability
**Researched:** 2026-03-22
**Confidence:** MEDIUM-HIGH (core stack HIGH; NanoClaw HTTP channel and WireGuard-on-Railway MEDIUM)

## Executive Summary

Network v2.0 transforms the existing social marketplace into a live agent subscription platform: users pay 50 USDC on Base to subscribe to an agent type, receive ownership, and can then chat with a live, containerized Claude agent in real-time. The architecture is a three-node distributed system — a Next.js app on Railway, a NanoClaw agent execution server on a VPS, and Supabase as the shared Postgres database and Realtime event bus. Communication between Railway and the VPS travels through a WireGuard encrypted tunnel, keeping the agent server off the public internet.

The recommended approach builds SIWE wallet authentication first (the root dependency for every v2.0 feature), migrates from SQLite to Supabase second (required for multi-service database access), then layers the payment flow, NanoClaw VPS deployment, and chat/observability on top. The critical path bottleneck is NanoClaw: it requires a custom HTTP channel to be forked into the codebase (no upstream HTTP channel exists), deployed to a VPS with Docker socket access, and connected via WireGuard before any live chat can function. Railway cannot run NanoClaw because it does not support Docker-in-Docker.

The primary risks are infrastructure unknowns: whether Railway containers can make outbound WireGuard (UDP) connections, and whether NanoClaw's 2-second SQLite polling loop is acceptable latency for interactive chat UX. Both must be validated before building any chat-dependent features. Secondary risks include wagmi SSR hydration errors if provider setup is wrong from the start, and SIWE nonce management requiring a deliberate decision (stateless cookie vs. Supabase row) before implementation begins.

## Key Findings

### Recommended Stack

The v2.0 stack extends the existing v1.0 base (Next.js 16.2.0, React 19, wagmi ^2, viem ^2, RainbowKit ^2, TailwindCSS v4) with targeted additions. The critical version constraint inherited from v1.0 is that wagmi must NOT be upgraded to v3 — RainbowKit 2.x is pinned to wagmi ^2.x.

**Core new technologies:**
- `@supabase/supabase-js ^2.99.3` + `@supabase/ssr ^0.8.1`: Replaces SQLite; enables Realtime, RLS, and concurrent access from both Railway and VPS. Never use deprecated `@supabase/auth-helpers-nextjs`.
- `siwe ^3.0.0` + `iron-session ^8.0.1`: Minimal SIWE auth stack. v3 removes ethers.js dependency; iron-session v8 is App Router-native (stateless encrypted cookie, no session table in Supabase).
- NanoClaw fork (TypeScript, `agent-server/`): Agent execution runtime. Provides container-per-turn isolation, credential proxy, and session persistence. Must add a custom `channels/webapp/` HTTP channel — no upstream implementation exists.
- `express ^5.1.0` (inside NanoClaw fork): Hosts the webapp HTTP channel at `:3002` that receives messages from Next.js.
- WireGuard (system-level, no npm package): Encrypts Railway-to-VPS communication. VPS is the WireGuard server (`10.0.0.1`), Railway container is the client. If outbound UDP is blocked on Railway, fall back to HTTPS + Caddy reverse proxy on VPS.
- `appleboy/ssh-action@v1.2.4` (GitHub Actions): Deploys `agent-server/` to VPS on push to main.
- USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals): Uses existing wagmi `useWriteContract` — no new packages. 50 USDC = `50_000_000n`.

### Expected Features

**Must have for v2.0 milestone (P1):**
- Supabase migration (SQLite to Postgres) — all subsequent features depend on this
- SIWE wallet sign-in with persistent iron-session cookie — root auth dependency
- 50 USDC payment flow with on-chain confirmation and ownership binding to wallet address
- NanoClaw fork on VPS with custom webapp HTTP channel
- WireGuard tunnel between Railway and VPS (or HTTPS fallback)
- Real-time chat UI with SSE token streaming
- Agent templates with Soul.md personality per type (5 agent types)
- Basic observability dashboard (LLM logs, token usage, tool calls via Supabase Realtime)
- CI/CD monorepo pipeline (GitHub Actions, path-filtered, separate deploy jobs)

**Should have — add after core is stable (P2):**
- Tool call visualization inline in chat (requires NanoClaw structured event emission)
- Agent file browser showing working directory contents
- Per-agent wallets for autonomous x402 payments

**Defer to v3+:**
- Learned skills tier, recurring on-chain subscriptions (ERC-4337), agent vault (at-rest encryption), mobile app

**Anti-features to reject:**
- Email/password auth (undermines wallet-as-identity architecture)
- WebSockets for chat (SSE is sufficient; WebSockets add stateful server complexity)
- Supabase Realtime for chat streaming (SSE direct from NanoClaw; Realtime is for observability only)
- Recurring auto-renew subscriptions (requires ERC-4337 account abstraction — weeks of work)

### Architecture Approach

The system is a three-node distributed architecture. The browser connects to the Next.js app on Railway over standard HTTP/SSE and connects directly to Supabase Realtime WebSocket for observability events (bypassing Next.js entirely). The Next.js app connects to Supabase (for data reads/writes) and to NanoClaw on VPS (for agent execution) via WireGuard tunnel with a shared secret header. NanoClaw runs a polling loop against internal SQLite, spawns per-turn Docker containers, and writes agent events back to Supabase.

**Major components:**
1. **Next.js App Router (Railway)** — Presentation, API orchestration, SIWE auth, SSE chat proxy to NanoClaw. All communication to NanoClaw is funneled through `lib/nanoclaw/client.ts`.
2. **SIWE Auth Layer** — EIP-4361 nonce/verify, iron-session encrypted cookie, agent ownership verification via `session.address === agent.owner_address`. Every v2.0 user-specific route requires this.
3. **SSE Chat Proxy (`/api/chat/[agentId]/stream`)** — Opens HTTP connection to NanoClaw over WireGuard private IP, pipes response as SSE to browser. Must set `export const dynamic = 'force-dynamic'` and Railway timeout to 120s.
4. **NanoClaw Webapp HTTP Channel (custom fork)** — `channels/webapp/index.ts`: Express server on `:3002`, validates `x-shared-secret` header, inserts messages into NanoClaw SQLite queue.
5. **NanoClaw Orchestrator (VPS)** — 2s polling loop; dequeues messages, spawns per-turn Docker containers running Claude Agent SDK; writes `agent_events` to Supabase via `supabase-logger.ts`.
6. **Credential Proxy (VPS `:3001`)** — MITM that injects real `ANTHROPIC_API_KEY`; containers only see a placeholder URL.
7. **Supabase** — Shared Postgres; `agent_events` table with Realtime enabled; RLS enforces owner-only access; `SUPABASE_SERVICE_ROLE_KEY` stays server-only, never in `NEXT_PUBLIC_*`.

**Monorepo structure:** `app/` (Next.js → Railway) + `agent-server/` (NanoClaw fork → VPS) under a pnpm workspace root. GitHub Actions path filters deploy only the changed package.

### Critical Pitfalls

1. **Wagmi/RainbowKit hydration mismatch** — Set `ssr: true` + `cookieStorage` in `createConfig()`, pass `cookieToInitialState()` from server headers to providers. Must be correct before building anything else on top of wallet state. Recovery retroactively is a medium-cost refactor.

2. **SUPABASE_SERVICE_ROLE_KEY exposed to client** — The service role key bypasses all RLS policies. Never put it in `NEXT_PUBLIC_*` env vars. Maintain separate `lib/supabase/server.ts` (service role) and `lib/supabase/browser.ts` (anon key) from day one.

3. **WireGuard on Railway (unverified)** — Railway may not allow outbound UDP 51820. If blocked, fall back to HTTPS + shared secret header with NanoClaw behind Caddy reverse proxy on VPS. Validate this in Phase 2 before any other NanoClaw work. This is the highest-uncertainty architectural decision.

4. **NanoClaw 2s polling latency** — The orchestrator checks SQLite every 2 seconds. For interactive chat UX this creates noticeable delay. Consider reducing `POLL_INTERVAL` or adding a direct invocation path in the fork. Validate UX acceptability in Phase 2 before building the chat UI.

5. **SIWE nonce replay vulnerability** — Each SIWE message requires a server-generated nonce stored somewhere to prevent replay. With stateless iron-session, choose before implementation: store nonce in pre-auth cookie OR in a short-lived Supabase row. Either works; the decision must be made before writing auth code.

6. **x402 `paymentMiddleware` charges on errors** — Use `withX402` route-level wrapper, not blanket middleware. On Next.js 16, the middleware file is `proxy.ts` with a default export (not `middleware.ts` with named exports).

7. **Clanker 1 deploy per wallet per 24h** — Deploy all agent tokens in one session early; use one wallet per agent type; record token addresses immediately. Never attempt to redeploy during a demo window.

8. **Webpack 5 missing Node.js polyfills** — Add `crypto-browserify`, `stream-browserify`, `buffer`, `process` fallbacks to `next.config.js` before adding any Web3 SDK.

## Implications for Roadmap

The feature dependency graph dictates a clear ordering. SIWE auth and Supabase are the two root dependencies — everything else in v2.0 blocks on them. NanoClaw VPS deployment is the highest-risk infrastructure task and must be proven early. Observability is additive and can trail chat. Payment can be built partly in parallel with VPS setup since it only depends on SIWE, not NanoClaw.

### Phase 1: Foundation Infrastructure
**Rationale:** SIWE auth, Supabase migration, and CI/CD are the three undisputed blockers. Wagmi SSR hydration setup must be correct here — fixing it retroactively after building wallet-dependent UI is a medium-cost refactor. Webpack polyfills must be in place before any Web3 SDK is installed.
**Delivers:** Working SIWE auth with iron-session cookie, Supabase Postgres accessible from both services, pnpm monorepo structure, GitHub Actions path-filtered CI/CD, wagmi SSR config correct.
**Addresses:** SIWE wallet sign-in, Supabase migration, CI/CD monorepo pipeline
**Avoids:** Wagmi hydration mismatch, service role key leaking to client bundle, Webpack 5 polyfill errors

### Phase 2: VPS and NanoClaw Deployment
**Rationale:** NanoClaw is the single highest-risk unknown. WireGuard-on-Railway must be validated at the start of this phase before building any chat feature. Failing this gate early maximizes time to pivot to the HTTPS fallback architecture.
**Delivers:** NanoClaw fork with webapp HTTP channel, WireGuard tunnel established (or HTTPS fallback confirmed), Docker container execution proven end-to-end, message round-trip tested with curl.
**Addresses:** NanoClaw fork with webapp channel, WireGuard tunnel, VPS Docker deployment
**Avoids:** WireGuard UDP block on Railway (validate and fall back to HTTPS + Caddy if needed), NanoClaw 2s polling latency surprises

### Phase 3: Subscription Payment Flow
**Rationale:** Depends on SIWE (Phase 1) for wallet identity but does NOT depend on NanoClaw — can be built while VPS work runs in parallel. Payment must precede agent launch: the USDC tx hash is the ownership proof.
**Delivers:** 50 USDC payment UI with tx confirmation, on-chain verification via `viem.getTransactionReceipt()`, agent ownership record in Supabase, subscription status badge.
**Addresses:** 50 USDC payment flow, agent ownership binding, subscription status display
**Avoids:** x402 `paymentMiddleware` charging on errors, `middleware.ts` vs `proxy.ts` on Next.js 16

### Phase 4: Agent Templates and Launch
**Rationale:** Depends on Supabase schema (Phase 1), payment proof (Phase 3), and NanoClaw running (Phase 2). Creates the five agent types with Soul.md personality files and skill directory structure. Agent launch wires payment confirmation to NanoClaw container initialization.
**Delivers:** `agent_templates` rows in Supabase, Soul.md per type, skill directory structure in `agent-server/`, agent launch trigger after payment confirmation, ERC-8004 idempotent registration.
**Addresses:** Agent templates, Soul.md personalities, agent launch flow, ERC-8004 registration
**Avoids:** Duplicate ERC-8004 registrations (idempotent check-before-register from the start)

### Phase 5: Live Chat UI
**Rationale:** Depends on all prior phases. NanoClaw must be running and proven (Phase 2), SIWE session must gate access (Phase 1), agent must exist post-payment (Phase 4). This is the first phase requiring all infrastructure simultaneously.
**Delivers:** SSE chat streaming UI, `ChatWindow.tsx` + `MessageInput.tsx`, message history persistence in Supabase, agent status indicator (running/idle), Enter-to-send.
**Addresses:** Real-time chat with SSE token streaming, message history, chat input UX
**Avoids:** Railway 30s request timeout (set `dynamic = 'force-dynamic'`, configure Railway timeout to 120s), WebSocket over-engineering

### Phase 6: Observability Dashboard
**Rationale:** Additive on top of working chat. NanoClaw must be writing `agent_events` to Supabase (Phase 2 completes this). Supabase Realtime must be explicitly enabled for the `agent_events` table in the dashboard.
**Delivers:** Real-time LLM log feed, token usage counter, tool call event feed, owner-only access via SIWE session check, `EventFeed.tsx` + `LlmLogEntry.tsx` + `TokenUsage.tsx` components.
**Addresses:** Observability dashboard, Supabase Realtime subscription, agent_events schema with RLS
**Avoids:** Forgetting to enable Realtime in Supabase dashboard (must enable via Database → Replication), Realtime free tier 200 concurrent connection limit (acceptable for demo)

### Phase 7: Differentiators (P2 polish)
**Rationale:** Add after core is stable and demo-ready. Tool call visualization requires NanoClaw to emit structured events (not just text). Per-agent wallets require key generation and USDC float funding.
**Delivers:** Tool call visualization inline in chat, agent file browser, per-agent keypair generation and x402 autonomous payments.
**Addresses:** Tool call visualization, file browser, per-agent wallet + x402 autonomous spending

### Phase Ordering Rationale

- SIWE and Supabase open Phase 1 because they are the undisputed root dependencies — no v2.0 feature can function without them.
- NanoClaw is Phase 2 (not later) because it is the highest-risk unknown: if WireGuard on Railway is blocked, the fallback architecture changes the implementation of Phases 5 and 6 and must be discovered early.
- Payment is Phase 3 and can overlap with Phase 2 — it only requires SIWE, not NanoClaw, so two workstreams can proceed in parallel.
- Chat is Phase 5 because it is the first feature requiring all infrastructure simultaneously — it should not be attempted until each prior phase has a passing integration test.
- Observability is Phase 6 because it is additive: events are written by NanoClaw; the dashboard just reads them. It does not block the core subscription demo.

### Research Flags

Phases requiring deeper research during planning:
- **Phase 2 (VPS + NanoClaw):** WireGuard outbound UDP on Railway is unverified. NanoClaw HTTP channel is greenfield fork work with no upstream reference. Both warrant a `/gsd:research-phase` call before implementation begins.
- **Phase 5 (Live Chat):** Whether the Claude Agent SDK inside a Docker container can stream tokens back through NanoClaw's IPC channel to the webapp HTTP endpoint is unconfirmed. May need a spike before committing to the SSE-pipe architecture.

Phases with standard, well-documented patterns (can skip deeper research):
- **Phase 1 (Foundation):** SIWE + iron-session v8 App Router pattern is documented. Supabase SSR helpers have official Next.js guides. Wagmi SSR setup is official docs.
- **Phase 3 (Payment):** ERC-20 direct `transfer()` via wagmi `useWriteContract` is straightforward. Circle docs cover USDC contract addresses. `viem.getTransactionReceipt()` for on-chain confirmation is standard.
- **Phase 6 (Observability):** Supabase Realtime `postgres_changes` is well-documented; the subscription pattern is copy-paste from official docs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Most packages verified from npm/GitHub with exact versions as of March 2026. WireGuard-on-Railway is the main gap (MEDIUM). `@supabase/ssr` is still at v0.8.1 stable (v0.10.0 RC exists but not ready). |
| Features | MEDIUM | Feature set is well-reasoned from the dependency graph and competitor analysis. AI agent subscription is a < 18-month-old pattern with limited prior art. Anti-feature decisions are opinionated but grounded. |
| Architecture | MEDIUM-HIGH | Three-node architecture and component boundaries are clear. NanoClaw fork specifics (streaming output, polling latency) are MEDIUM — require implementation spikes to confirm. |
| Pitfalls | HIGH | Most pitfalls sourced from official docs, issue trackers, and battle-tested wagmi/Supabase patterns. NanoClaw-specific pitfalls are inferred from architecture (fewer post-mortems available). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **WireGuard on Railway outbound UDP:** Must be validated in Phase 2 before building chat. If UDP 51820 is blocked, fall back to HTTPS + Caddy reverse proxy on VPS (NanoClaw binds to public HTTPS endpoint, shared secret header provides auth).
- **NanoClaw streaming output:** Whether the Claude Agent SDK inside a Docker container can stream tokens through NanoClaw's IPC to the webapp channel is unconfirmed. If not, Phase 5 falls back to polling Supabase for completed turns (adds latency, changes UX).
- **SIWE nonce storage strategy:** Must decide before Phase 1 auth implementation: pre-auth session cookie (simpler) vs. short-lived Supabase nonce row (more auditable). Either works — commit to one approach.
- **Supabase Realtime free tier limit:** Free tier = 200 concurrent WebSocket connections. Acceptable for hackathon but verify before opening observability in multiple browser tabs simultaneously.
- **`@supabase/ssr` version:** v0.10.0 RC at time of research (March 2026). Use v0.8.1 stable. Monitor for v0.10.0 stable before any production push.

## Sources

### Primary (HIGH confidence)
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.99.3 confirmed
- [@supabase/ssr GitHub releases](https://github.com/supabase/ssr/releases) — v0.8.1 stable confirmed
- [Supabase Realtime Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription API verified
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS patterns verified
- [siwe GitHub releases](https://github.com/spruceid/siwe/releases) — v3.0.0 confirmed January 2026
- [iron-session GitHub releases](https://github.com/vvo/iron-session/releases) — v8.0.1 confirmed
- [ERC-4361: Sign-In with Ethereum — Official EIP](https://eips.ethereum.org/EIPS/eip-4361)
- [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) — Base mainnet 0x833589... confirmed
- [Railway monorepo docs](https://docs.railway.com/guides/monorepo) — watch paths, root directory pattern
- [appleboy/ssh-action GitHub](https://github.com/appleboy/ssh-action) — v1.2.4 confirmed
- [wagmi useWriteContract docs](https://wagmi.sh/react/api/hooks/useWriteContract) — ERC-20 write pattern
- [Wagmi SSR Guide (official)](https://wagmi.sh/react/guides/ssr) — hydration + cookieStorage pattern
- [x402-next npm documentation](https://www.npmjs.com/package/@x402/next) — withX402 vs paymentMiddleware
- [Self Protocol Basic Integration (official docs)](https://docs.self.xyz/contract-integration/basic-integration)
- [Clanker Changelog](https://clanker.gitbook.io/clanker-documentation/changelog) — rate limit, v4 details
- [ENS Address Lookup (official docs)](https://docs.ens.domains/web/resolution/)

### Secondary (MEDIUM confidence)
- [NanoClaw GitHub — qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw) — architecture and channel interface verified
- [NanoClaw DeepWiki](https://deepwiki.com/openclaw-shi/nanoclaw) — polling architecture, SQLite model
- [wagmi SIWE example](https://1.x.wagmi.sh/examples/sign-in-with-ethereum) — integration pattern
- [SIWE Best Practices 2025 — Markaicode](https://markaicode.com/siwe-best-practices-2025/)
- [WireGuard VPS tunnel guides](https://diymediaserver.com/post/2026/install-wireguard-vps-homelab-tunnel/) — Railway UDP constraint unverified
- [x402 with Next.js 16 — proxy.ts pattern](https://dev.to/shahbaz17/using-x402-next-with-nextjs-16-1me1)
- [SSE Still Wins in 2026 — procedure.tech](https://procedure.tech/blogs/the-streaming-backbone-of-llms-why-server-sent-events-(sse)-still-wins-in-2025)
- [LLM Observability Best Practices 2025 — getmaxim.ai](https://www.getmaxim.ai/articles/llm-observability-best-practices-for-2025/)
- [USDC Payment-Gated Application — Circle Blog](https://www.circle.com/blog/build-a-usdc-payment-gated-app-with-circle-sdk)

### Tertiary (LOW confidence — needs validation)
- [AG-UI Protocol Overview — DataCamp](https://www.datacamp.com/tutorial/ag-ui) — tool call visualization pattern; single source
- [The Future of AI Agent Marketplaces 2025-2030 — FutureForce](https://futureforce.ai/content/future-of-ai-agent-marketplaces/) — speculative market analysis

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
