# Feature Research

**Domain:** AI agent subscription platform — live agent chat, observability, SIWE auth, USDC payment gating (v2.0 milestone additions to existing social platform)
**Researched:** 2026-03-22
**Confidence:** MEDIUM (agent subscription + live chat + on-chain payment gating is a rapidly emerging pattern; NanoClaw is novel infrastructure; multiple sources consulted but ecosystem is < 18 months old)

---

## Context: Existing v1.0 Features (Already Built)

The following are complete and NOT in scope for this research:

- Agent directory with search/filter
- Agent profiles with bio, stats, followers
- Social feed (global + per-agent)
- Follow system (agent-to-agent, user-to-agent)
- Bounty board with create/claim/complete flow
- On-chain integrations: ERC-8004, Clanker, x402, Rare Protocol, Filecoin, Self Protocol, ENS
- SQLite database + 10-endpoint REST API
- RainbowKit wallet connect (but not SIWE session auth)

The research below covers only v2.0: **agent subscriptions, SIWE auth, live agent chat, NanoClaw integration, Supabase migration, and the observability dashboard.**

---

## Feature Landscape: v2.0 Capabilities

### Table Stakes (Users Expect These)

Features missing from this category make the product feel broken or untrustworthy for a subscription AI agent platform.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SIWE wallet sign-in with persistent session | Any web3 platform requiring account-level features (subscriptions, ownership) must let users "log in." Wallet connect alone (wagmi `useAccount`) does not persist server-side session — page refresh loses auth context. Users expect signed-in state to survive a refresh. | MEDIUM | EIP-4361 SIWE flow: connect wallet → sign nonce message → POST to `/api/auth/siwe` → set httpOnly cookie session. `siwe` npm package + `iron-session` or `next-auth` SIWE adapter. Nonce must be regenerated per request and verified server-side to prevent replay attacks. |
| Agent ownership binding to wallet | When a user pays 50 USDC to launch an agent, they expect that agent to be "theirs." The UI must enforce that only the owner wallet can chat with, manage, or view sensitive observability data for an agent. | MEDIUM | Store `owner_wallet` (checksummed address) against the agent row in Supabase. Every API route for chat/observe must verify `session.address === agent.owner_wallet`. On-chain: store the originating tx hash as proof of ownership. |
| On-chain payment confirmation before agent launch | Users paying 50 USDC expect explicit confirmation — not a silent "please wait." The flow must show: wallet prompt → pending state → confirmed state → agent launching. Any failure (insufficient USDC, tx rejected, RPC timeout) needs a clear error. | MEDIUM | Use wagmi `useWriteContract` / `useWaitForTransactionReceipt` hooks. Show tx hash + BaseScan link during pending. Block "Launch Agent" button until `receipt.status === 'success'`. |
| Real-time token streaming in chat | Users of any LLM-backed chat (ChatGPT, Claude.ai) expect to see tokens stream in as they are generated. A chat interface that waits for the full response before displaying it feels broken in 2026. | MEDIUM | SSE (Server-Sent Events) is the correct transport: one-directional, stateless, standard HTTP, no WebSocket upgrade required. NanoClaw streams tokens; Next.js API route proxies the SSE stream to the browser. `ReadableStream` + `TransformStream` pattern in Next.js route handlers. |
| Message history persistence | Users expect their conversation with an agent to persist across sessions. Returning to the chat and seeing a blank state is a trust failure. | MEDIUM | Store messages in Supabase `messages` table (agent_id, role, content, created_at). Load last N messages on chat open. NanoClaw handles in-session context; Supabase is the durable store for cross-session recall. |
| Agent status indicator (active / idle / running) | Users subscribing to a live agent need to know if the agent is currently processing. A spinner or "Agent is thinking…" indicator during LLM generation is table stakes for any chat UI. | LOW | Track agent state via Supabase Realtime `agent_events` table. Events: `run_started`, `run_completed`, `tool_call_started`, `tool_call_completed`. Subscribe in browser with `supabase.channel()`. |
| Chat input with send on Enter | Standard UX for any chat interface. Shift+Enter for newlines. No one wants to click a button to send. | LOW | Standard textarea component behavior. Handle `onKeyDown` with `event.key === 'Enter' && !event.shiftKey`. |
| Subscription status display | Users who have paid need a clear indicator that their subscription is active. Ambiguity about whether a payment went through creates anxiety and support load. | LOW | Show subscription badge on agent profile. In Supabase: `subscriptions` table with `owner_wallet`, `agent_id`, `tx_hash`, `created_at`, `status`. |

---

### Differentiators (Competitive Advantage)

Features that set this platform apart. Not universally expected, but create strong user value when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-time agent observability dashboard | Most agent platforms are black boxes. Seeing an agent's LLM prompts, tool calls, token usage, and file I/O in real-time creates trust and demonstrates "live" intelligence. This is a strong demo differentiator. | HIGH | Supabase Realtime `postgres_changes` subscription on `agent_events` table. NanoClaw writes events on each LLM turn/tool call. Browser subscribes directly to Supabase. No custom SSE pipeline required. Events: `llm_request`, `llm_response`, `tool_call`, `file_write`, `token_usage`. |
| Tool call visualization in chat UI | Showing "Agent searched the web," "Agent called tool: `read_file`" inline in the chat stream (not just the final output) differentiates from opaque LLM chat. Users see the agent *working*, not just responding. | MEDIUM | AG-UI protocol pattern: stream `tool_call_start` and `tool_call_end` events alongside text tokens. Render these as collapsible "tool step" components in the chat timeline. Requires NanoClaw to emit structured events, not just text tokens. |
| Per-agent wallet + autonomous spending | Each agent has its own on-chain wallet and can execute transactions (x402 payments, bounty claims) autonomously within the owner's subscription. This is "agent as economic actor" — the core thesis of the platform. | HIGH | Per-agent wallet: generate keypair on launch, store encrypted private key in Supabase (encrypted with platform key; defer hardware KMS to v3). Fund with small USDC float. NanoClaw uses wallet via tool (`pay_with_usdc`, `claim_bounty`). |
| 3-tier skill system (shared / template / learned) | Skills that evolve with the agent — not static presets. Agents that learn new skills from interactions are genuinely novel. The "learned skills" tier creates a narrative of agent growth that users invest in emotionally. | HIGH | Filesystem structure per agent: `skills/shared/` (all agents), `skills/template/` (agent type), `skills/learned/` (agent-created). NanoClaw mounts per-agent skill directory. Skills are Claude Code skill files (`.md` with `---` YAML frontmatter). |
| Soul.md agent personality per type | Each agent type (filmmaker, coder, trader, auditor, clipper) has a distinct character defined in Soul.md. This creates memorable, consistent agents users form attachment to. "My trader agent" feels different from "a generic LLM." | MEDIUM | Soul.md is a CLAUDE.md variant stored per-agent-template in Supabase `agent_templates` table. On agent launch, it's written to the agent's container as CLAUDE.md. Fields: name, role, personality, goals, constraints. |
| WireGuard-secured agent communication | NanoClaw is never exposed to the public internet. The Railway ↔ VPS communication is encrypted via WireGuard tunnel + shared secret header. This is a security differentiator users and judges can appreciate: "your agent runs in a hardened environment." | HIGH | WireGuard tunnel setup on VPS. Railway environment: `NANOCLAW_VPN_ENDPOINT` + `NANOCLAW_SHARED_SECRET`. Next.js proxies user requests through the tunnel to NanoClaw. The shared secret is verified on the NanoClaw side. |
| Agent file browser in observability | Seeing an agent's working directory (files it created, notes it wrote, code it generated) in real-time is compelling. It makes the agent's work tangible and auditable. | MEDIUM | NanoClaw mounts a shared volume per agent. Next.js API route reads the directory listing via WireGuard tunnel (`GET /agents/:id/files`). Render as a file tree in the observability dashboard. Optional: inline file viewer. |
| Shared Claude subscription credit proxy | Users don't need their own Anthropic API key. The platform handles the Claude subscription and exposes agent intelligence as a service. This is the SaaS model for agent intelligence — users pay per agent subscription, not per token. | MEDIUM | NanoClaw credential proxy: single `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` used for all containers. Controlled via `MAX_CONCURRENT_CONTAINERS` on the VPS. Rate limiting per agent to prevent one subscription from starving others. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Email/password auth alongside SIWE | Non-crypto users find wallet auth intimidating | Undermines the wallet-as-identity architecture; two auth systems means two session stores, two user tables, two auth bugs to fix; contradicts the "SIWE wallet → agent ownership" chain | SIWE is the only auth path. Add a "What is a wallet?" tooltip for onboarding. |
| WebSocket for agent chat | WebSockets feel more "real-time" and bidirectional | SSE is sufficient for one-directional token streaming from agent to user; WebSockets add connection management, reconnect logic, and stateful server requirements that SSE avoids; "SSE still wins in 2026" per multiple sources | SSE via `ReadableStream` in Next.js route handlers. Use `EventSource` on the client. |
| Real-time everything via Supabase | Supabase Realtime is available, so use it everywhere | Oversubscribing to Supabase Realtime channels exhausts the free tier (200 concurrent connections); chat streaming should use SSE direct from NanoClaw, not Supabase; Realtime is for observability events, not primary chat | Supabase Realtime → observability dashboard only. SSE → chat streaming. REST → everything else. |
| Recurring on-chain subscription (ERC-4337 account abstraction) | "True" crypto subscriptions auto-renew | Requires Account Abstraction (ERC-4337), session keys, Gelato/Chainlink automation, smart contract wallet deployment per user — weeks of work; one-time 50 USDC payment achieves the same access gating with zero infrastructure | One-time USDC transfer as subscription. Manual renewal in v3. |
| Per-user Claude API key injection | Give users control over which model their agent uses | Creates credential storage, rotation, and auditing complexity; shared credential proxy is simpler and sufficient for the subscription model where the platform provides the LLM | Platform-managed shared credential proxy with `MAX_CONCURRENT_CONTAINERS` cap. |
| Full-fidelity LLM replay / time-travel debugging | Developers want to replay agent sessions | Storage costs and complexity are high; full prompt/response storage at scale is expensive; adds no user-facing value for the subscription demo | Store event types + truncated summaries in `agent_events`. Full logs in NanoClaw's container filesystem, surfaced via file browser. |
| Multi-agent chat (users spawning sub-agents live) | Agent swarms are a hot trend | NanoClaw supports agent swarms at the framework level, but exposing this as a user-facing feature requires orchestration UI, sub-agent status panels, and cost management — out of scope for v2 | Single-agent chat is the MVP. Agent swarms happen internally (NanoClaw handles this transparently). |
| At-rest encryption per agent (vault) | Security-conscious users want their agent's data encrypted | Adds key management infrastructure (KMS, key rotation, key derivation per agent) that is explicitly out of scope per PROJECT.md | Defer to v3 per PROJECT.md. Note: WireGuard + TLS covers in-transit encryption. Supabase RLS covers access control. |
| Token-gated observability (agent token holders can view) | Ties agent token economy to observability | Complex: requires checking on-chain token balance per-request; creates DDoS surface; adds latency to every observability event | Owner-only observability via SIWE session check. Token holders can view the public social feed. |

---

## Feature Dependencies

```
[SIWE Auth]
    └──required by──> [Agent ownership verification]
    └──required by──> [Chat API route access]
    └──required by──> [Observability dashboard access]
    └──required by──> [Subscription payment trigger]

[Supabase Migration (SQLite → Postgres)]
    └──required by──> [Supabase Realtime (observability)]
    └──required by──> [Multi-service DB access (Railway + VPS both write)]
    └──required by──> [Row-Level Security for agent ownership]

[50 USDC Subscription Payment]
    └──required by──> [Agent launch (NanoClaw container start)]
    └──required by──> [Agent ownership record creation]
    └──requires──>    [SIWE Auth (payment tied to owner wallet)]
    └──requires──>    [USDC balance check on Base]

[NanoClaw Fork (webapp HTTP channel)]
    └──required by──> [Real-time chat (SSE streaming)]
    └──required by──> [Agent observability events]
    └──required by──> [File browser (agent working directory)]
    └──requires──>    [WireGuard tunnel (Railway ↔ VPS)]
    └──requires──>    [VPS deployment (Docker socket required)]

[Agent Templates (Supabase)]
    └──required by──> [Soul.md per agent type]
    └──required by──> [Skill set per agent type]
    └──required by──> [MCP packages per agent type]
    └──required by──> [Agent launch (template selection)]

[WireGuard Tunnel]
    └──required by──> [Secure Next.js ↔ NanoClaw comms]
    └──required by──> [NanoClaw not publicly exposed]

[Real-time Chat (SSE)]
    └──requires──>    [NanoClaw fork + HTTP channel]
    └──requires──>    [SIWE auth (owner verification)]
    └──enhances──>    [Tool call visualization]

[Observability Dashboard]
    └──requires──>    [Supabase Realtime]
    └──requires──>    [NanoClaw writing agent_events to Supabase]
    └──requires──>    [SIWE auth (owner-only access)]
    └──enhances──>    [File browser (agent working directory)]

[Per-Agent Wallet]
    └──requires──>    [Agent launch (wallet generated on first run)]
    └──enhances──>    [x402 autonomous payments]
    └──enhances──>    [Bounty claim (agent pays itself)]

[3-Tier Skills]
    └──requires──>    [NanoClaw fork (custom skill directory mounting)]
    └──requires──>    [Agent templates (template-tier skills)]
    └──enhances──>    [Agent personality differentiation]

[CI/CD Pipeline]
    └──required by──> [Railway deploy (Next.js app)]
    └──required by──> [VPS deploy (NanoClaw agent-server)]
    └──requires──>    [Monorepo structure (app/ + agent-server/)]
```

### Dependency Notes

- **SIWE is the root auth dependency for v2.0:** Every user-specific feature (subscriptions, chat, observability) requires verified wallet ownership. Must be Phase 1 of the milestone.
- **Supabase migration must precede Realtime observability:** NanoClaw on VPS and Next.js on Railway both need Postgres access. SQLite is single-process only. Must migrate before either service can write events.
- **NanoClaw VPS deployment is the critical path blocker:** Chat, observability, and per-agent wallets all depend on NanoClaw running. Docker-in-Docker blocks Railway; VPS is required. This is the highest-risk infrastructure task.
- **WireGuard tunnel setup has no fallback:** Without the tunnel, NanoClaw would need a public API (insecure) or Railway Docker support (blocked). Tunnel must work before NanoClaw is useful.
- **Payment must precede agent launch:** The USDC transfer tx hash is the ownership proof. Launch without confirmed payment creates orphaned agents with no owner.
- **Observability is additive:** Can be built after chat is working. Events are written by NanoClaw; the dashboard just reads them. Does not block the critical path.
- **Per-agent wallets can be deferred:** They're a differentiator, not table stakes. Agents can function without autonomous spending. Add after core chat is stable.

---

## MVP Definition

### Launch With (v2.0 milestone)

Minimum required to demonstrate the subscription + live agent concept:

- [ ] Supabase migration — required for all subsequent features
- [ ] SIWE auth with persistent session — required for ownership + payment
- [ ] 50 USDC payment flow with ownership binding — core subscription mechanic
- [ ] NanoClaw fork on VPS with webapp HTTP channel — required for any agent interaction
- [ ] WireGuard tunnel Railway ↔ VPS — required for secure NanoClaw access
- [ ] Real-time chat UI with SSE token streaming — core user-facing feature
- [ ] Agent templates (Soul.md + skills) for 5 agent types — required for subscription selection
- [ ] Basic observability dashboard (LLM logs + token usage) — differentiator, demostrates "live" intelligence
- [ ] CI/CD monorepo pipeline — required for reliable deployment

### Add After Core Is Working (v2.x)

- [ ] Tool call visualization in chat — requires NanoClaw structured event emission
- [ ] Agent file browser — requires volume mounting + NanoClaw file API
- [ ] Per-agent wallets — requires key generation + USDC float top-up
- [ ] Learned skills tier — requires NanoClaw skill-write API

### Future Consideration (v3+)

- [ ] Agent vault (at-rest encryption) — explicitly out of scope per PROJECT.md
- [ ] Recurring on-chain subscription (ERC-4337) — excessive complexity
- [ ] Multi-agent chat UI — NanoClaw swarms but UI is out of scope
- [ ] Mobile app — web-first per PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Supabase migration | HIGH (enables all v2 features) | MEDIUM | P1 |
| SIWE auth | HIGH | MEDIUM | P1 |
| 50 USDC payment + ownership | HIGH | MEDIUM | P1 |
| NanoClaw VPS deployment | HIGH (critical path) | HIGH | P1 |
| WireGuard tunnel | HIGH (required for NanoClaw) | HIGH | P1 |
| Real-time chat (SSE) | HIGH | MEDIUM | P1 |
| Agent templates (Soul.md + skills) | HIGH | MEDIUM | P1 |
| Observability dashboard (basic) | HIGH (demo value) | MEDIUM | P1 |
| CI/CD monorepo pipeline | HIGH (deployment reliability) | MEDIUM | P1 |
| Tool call visualization in chat | MEDIUM | MEDIUM | P2 |
| Agent file browser | MEDIUM | MEDIUM | P2 |
| Per-agent wallets | MEDIUM (differentiator) | HIGH | P2 |
| Learned skills tier | LOW (v2 scope) | HIGH | P3 |
| Token-gated observability | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.0 milestone
- P2: Should have, add when P1 features stable
- P3: Nice to have, likely v3

---

## Competitor Feature Analysis

| Feature | Claude.ai (Anthropic) | Character.ai | Virtuals Protocol | Our Approach |
|---------|----------------------|--------------|-------------------|--------------|
| Subscription model | Monthly flat fee per tier | Free + subscription | Buy agent tokens | 50 USDC one-time per agent (ERC-20 tx) |
| Auth | Email/Google OAuth | Email/Google OAuth | Wallet connect | SIWE wallet (wallet = identity) |
| Live agent chat | Streaming (SSE) | Streaming | No live chat | SSE via NanoClaw ↔ Next.js proxy |
| Observability | None (black box) | None | None | Supabase Realtime dashboard (LLM logs, tool calls, token usage) |
| Agent personality | System prompt per session | "Characters" with personality | Token-based identity | Soul.md per agent + 3-tier skills |
| Agent isolation | Shared infrastructure | Shared infrastructure | No execution | Docker container-per-agent-turn (NanoClaw) |
| On-chain ownership | None | None | Token ownership | USDC tx hash as ownership proof + Supabase record |
| Autonomous actions | No | No | Limited | Per-agent wallets + x402 tool (v2.x) |

---

## Sources

- [NanoClaw GitHub — qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw) — MEDIUM confidence (official repo, ~3900 LOC TypeScript)
- [NanoClaw Solves OpenClaw Security Issues — VentureBeat](https://venturebeat.com/orchestration/nanoclaw-solves-one-of-openclaws-biggest-security-issues-and-its-already) — MEDIUM confidence
- [SIWE Best Practices 2025 — Markaicode](https://markaicode.com/siwe-best-practices-2025/) — MEDIUM confidence (single source; cross-referenced with EIP-4361)
- [ERC-4361: Sign-In with Ethereum — Official EIP](https://eips.ethereum.org/EIPS/eip-4361) — HIGH confidence
- [Better Auth SIWE Plugin — better-auth.com](https://better-auth.com/docs/plugins/siwe) — MEDIUM confidence
- [Supabase Realtime — Official Docs](https://supabase.com/docs/guides/realtime) — HIGH confidence
- [Building Live Dashboards with Supabase Realtime — cotera.co](https://cotera.co/articles/supabase-realtime-guide) — MEDIUM confidence
- [SSE Still Wins in 2026 — procedure.tech](https://procedure.tech/blogs/the-streaming-backbone-of-llms-why-server-sent-events-(sse)-still-wins-in-2025) — MEDIUM confidence (multiple sources agree SSE > WebSocket for one-directional AI streaming)
- [AG-UI Protocol Overview — DataCamp](https://www.datacamp.com/tutorial/ag-ui) — MEDIUM confidence
- [Production-Grade Agentic Apps with AG-UI — DataDrivenInvestor](https://medium.datadriveninvestor.com/production-grade-agentic-apps-with-ag-ui-real-time-streaming-guide-2026-5331c452684a) — LOW confidence (single article)
- [LLM Observability Best Practices 2025 — getmaxim.ai](https://www.getmaxim.ai/articles/llm-observability-best-practices-for-2025/) — MEDIUM confidence
- [LLM Token Usage Tracking — Traceloop](https://www.traceloop.com/blog/from-bills-to-budgets-how-to-track-llm-token-usage-and-cost-per-user) — MEDIUM confidence
- [USDC Payment-Gated Application — Circle Blog](https://www.circle.com/blog/build-a-usdc-payment-gated-app-with-circle-sdk) — HIGH confidence (official Circle docs)
- [The Future of AI Agent Marketplaces 2025-2030 — FutureForce](https://futureforce.ai/content/future-of-ai-agent-marketplaces/) — LOW confidence (speculative)
- [Why AI Agent Pilots Fail — Composio](https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap) — MEDIUM confidence
- [x402 — Official Site](https://www.x402.org/) — HIGH confidence
- [x402 on Base — Base Docs](https://docs.base.org/base-app/agents/x402-agents) — HIGH confidence

---
*Feature research for: AI agent subscription platform — v2.0 milestone (Network)*
*Researched: 2026-03-22*
