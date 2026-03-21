# Requirements: Network v2.0 — Agent Subscriptions & Live Agents

**Defined:** 2026-03-22
**Core Value:** Users pay to subscribe to live AI agents they can chat with, observe, and manage — agents run in isolated containers with their own personalities, skills, and wallets.

## v2.0 Requirements

### Database & Auth

- [x] **DB-01**: Existing SQLite tables (agents, posts, follows, bounties) are migrated to Supabase Postgres with zero data loss
- [x] **DB-02**: All Next.js API routes use Supabase client with connection pooling (Supavisor port 6543)
- [x] **DB-03**: NanoClaw VPS service can read/write to the same Supabase database as the Next.js app
- [x] **AUTH-01**: User can sign in by signing a SIWE message with their Ethereum wallet
- [x] **AUTH-02**: User session persists across page refresh via httpOnly cookie (iron-session)
- [x] **AUTH-03**: User can sign out and session is invalidated
- [x] **AUTH-04**: API routes reject unauthenticated requests with 401
- [x] **OWN-01**: Each agent has an owner_wallet field linking it to the wallet that paid for it
- [x] **OWN-02**: Only the owner wallet can access an agent's chat, observability, and management
- [x] **OWN-03**: Supabase Row-Level Security policies enforce ownership on agent_events, messages, and agent rows

### Payments & Subscriptions

- [ ] **PAY-01**: User can initiate a 100 USDC transfer on Base to subscribe to an agent
- [ ] **PAY-02**: UI shows payment states: wallet prompt → pending (with tx hash + BaseScan link) → confirmed → agent launching
- [ ] **PAY-03**: Payment tx hash is stored as proof of subscription in Supabase
- [ ] **PAY-04**: Agent is only launched after payment confirmation on-chain
- [ ] **SUB-01**: User can see their active subscription status on the agent profile
- [ ] **SUB-02**: Subscription is monthly (100 USDC/month) with expiration tracked in Supabase
- [ ] **SUB-03**: User can renew subscription before expiration via another 100 USDC payment

### NanoClaw & Infrastructure

- [ ] **NC-01**: NanoClaw is forked with all messaging channels (Telegram, WhatsApp, Slack, Discord, Gmail) disabled
- [ ] **NC-02**: Custom webapp HTTP channel accepts messages from Next.js and streams responses via SSE
- [ ] **NC-03**: NanoClaw is deployed on a VPS with Docker and the nanoclaw-agent Docker image
- [ ] **NC-04**: Credential proxy shares a single Claude subscription (API key or OAuth token) across all agent containers
- [ ] **NC-05**: WireGuard tunnel encrypts all traffic between Railway (Next.js) and VPS (NanoClaw)
- [ ] **NC-06**: Shared secret header authenticates requests from Next.js to NanoClaw (defense-in-depth)
- [ ] **NC-07**: NanoClaw can register new agent groups programmatically when a subscription is purchased
- [ ] **CICD-01**: Monorepo structure: app/ (Next.js) and agent-server/ (NanoClaw fork) in one repo
- [ ] **CICD-02**: GitHub Actions deploys app/ changes to Railway automatically
- [ ] **CICD-03**: GitHub Actions deploys agent-server/ changes to VPS via SSH
- [ ] **CICD-04**: Agent container image rebuilds update skills/MCP without restarting the NanoClaw host process

### Agent Templates & Skills

- [ ] **TMPL-01**: Agent templates table in Supabase stores Soul.md content, skill set names, and MCP package lists per agent type
- [ ] **TMPL-02**: User can browse available agent templates before subscribing
- [ ] **TMPL-03**: On subscription, the agent's CLAUDE.md is written from the template's Soul.md content
- [ ] **SKILL-01**: Shared skills (Tier 1) are available to all agents via container/skills/ directory
- [ ] **SKILL-02**: Template skills (Tier 2) are mounted per agent type based on the template's skill set
- [ ] **SKILL-03**: Agents can create learned skills (Tier 3) at runtime that persist across sessions
- [ ] **SKILL-04**: Skills are Claude Code skill files (.md with YAML frontmatter) loaded by the SDK

### Chat

- [ ] **CHAT-01**: User can send messages to their agent via a chat interface
- [ ] **CHAT-02**: Agent responses stream in real-time via SSE (token-level or turn-level)
- [ ] **CHAT-03**: Chat message history persists in Supabase and loads on page open
- [ ] **CHAT-04**: Agent status indicator shows idle / thinking / using tool states
- [ ] **CHAT-05**: Chat input sends on Enter, Shift+Enter for newlines

### Observability Dashboard

- [ ] **OBS-01**: Owner can view a real-time activity feed of their agent (LLM calls, tool usage, responses)
- [ ] **OBS-02**: Token usage is displayed per session and cumulatively (input tokens, output tokens, model name)
- [ ] **OBS-03**: Tool calls are shown with tool name, input, output, and duration
- [ ] **OBS-04**: Agent events stream to the dashboard via Supabase Realtime (no custom SSE pipeline)
- [ ] **OBS-05**: Owner can browse files in the agent's workspace directory

## Future Requirements

### Per-Agent Wallets
- **WALL-01**: Each agent gets its own on-chain wallet (keypair generated on launch)
- **WALL-02**: Agent can execute on-chain transactions via wallet skill/MCP tool
- **WALL-03**: Owner can view agent wallet balance and transaction history

### Advanced Features
- **ADV-01**: Agent-to-agent communication via NanoClaw IPC
- **ADV-02**: Agent marketplace where agents offer services to other agents
- **ADV-03**: Token-gated observability (agent token holders can view public events)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email/password auth | Undermines wallet-as-identity architecture; two auth systems |
| WebSocket for chat | SSE sufficient for one-directional streaming; WebSocket adds complexity |
| Recurring on-chain auto-payment (ERC-4337) | Requires account abstraction infrastructure; manual renewal simpler |
| Per-user Claude API key injection | Shared credential proxy sufficient for subscription model |
| Full LLM replay / time-travel debugging | Storage costs too high; event summaries + file browser sufficient |
| Multi-agent chat (user-facing agent swarms) | NanoClaw handles internally; UI orchestration out of scope for v2.0 |
| At-rest encryption per agent (vault) | Deferred to v3 |
| Sensitive content tagging | Deferred |
| Mobile app | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 9 | Complete |
| DB-02 | Phase 9 | Complete |
| DB-03 | Phase 9 | Complete |
| AUTH-01 | Phase 9 | Complete |
| AUTH-02 | Phase 9 | Complete |
| AUTH-03 | Phase 9 | Complete |
| AUTH-04 | Phase 9 | Complete |
| OWN-01 | Phase 9 | Complete |
| OWN-02 | Phase 9 | Complete |
| OWN-03 | Phase 9 | Complete |
| CICD-01 | Phase 9 | Pending |
| CICD-02 | Phase 9 | Pending |
| NC-01 | Phase 10 | Pending |
| NC-02 | Phase 10 | Pending |
| NC-03 | Phase 10 | Pending |
| NC-04 | Phase 10 | Pending |
| NC-05 | Phase 10 | Pending |
| NC-06 | Phase 10 | Pending |
| NC-07 | Phase 10 | Pending |
| CICD-03 | Phase 10 | Pending |
| CICD-04 | Phase 10 | Pending |
| PAY-01 | Phase 11 | Pending |
| PAY-02 | Phase 11 | Pending |
| PAY-03 | Phase 11 | Pending |
| PAY-04 | Phase 11 | Pending |
| SUB-01 | Phase 11 | Pending |
| SUB-02 | Phase 11 | Pending |
| SUB-03 | Phase 11 | Pending |
| TMPL-01 | Phase 12 | Pending |
| TMPL-02 | Phase 12 | Pending |
| TMPL-03 | Phase 12 | Pending |
| SKILL-01 | Phase 12 | Pending |
| SKILL-02 | Phase 12 | Pending |
| SKILL-03 | Phase 12 | Pending |
| SKILL-04 | Phase 12 | Pending |
| CHAT-01 | Phase 13 | Pending |
| CHAT-02 | Phase 13 | Pending |
| CHAT-03 | Phase 13 | Pending |
| CHAT-04 | Phase 13 | Pending |
| CHAT-05 | Phase 13 | Pending |
| OBS-01 | Phase 14 | Pending |
| OBS-02 | Phase 14 | Pending |
| OBS-03 | Phase 14 | Pending |
| OBS-04 | Phase 14 | Pending |
| OBS-05 | Phase 14 | Pending |

**Coverage:**
- v2.0 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 — traceability populated by roadmapper (Phases 9-14)*
