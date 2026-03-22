# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Users pay to subscribe to live AI agents they can chat with, observe, and manage — agents run in isolated containers with their own personalities, skills, and wallets.
**Current focus:** Phase 10 — NanoClaw VPS Deployment (complete; awaiting human-verify checkpoint on 10-06 Task 2)

## Current Position

Phase: 10 of 14 (NanoClaw VPS Deployment)
Plan: 6 of 6 in current phase (e2e test script created; 4/4 tests passing; awaiting human-verify checkpoint)
Status: Active — checkpoint reached at 10-06 Task 2 (human-verify: confirm e2e-test.sh output)
Last activity: 2026-03-22 — 10-06 Task 1 complete (e2e-test.sh created; 2 bugs fixed; all 4 tests pass)

Progress: [█████████░░░░░░░░░░░] ~55% (v1.0 done; Phase 09 complete; Phase 10 infra proven)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 18
- Average duration: 4min
- Total execution time: ~0.82 hours

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 9min | 3min |
| 02-filecoin-storage | 2 | 14min | 7min |
| 03-erc-8004-identity | 3 | 11min | 4min |
| 04-clanker-tokens | 2 | 6min | 3min |
| 05-x402-payments | 2 | 5min | 2.5min |
| 06-nft-minting | 2 | 5min | 2.5min |
| 07-self-protocol-zk | 2 | 6min | 3min |
| 08-autonomous-loop | 3 | 6min | 2min |

*Updated after each plan completion*
| Phase 09-foundation-infrastructure P03 | 8 | 3 tasks | 17 files |
| Phase 09-foundation-infrastructure P04 | 15 | 1 tasks | 107 files |
| Phase 10-nanoclaw-vps-deployment P01 | 15 | 2 tasks | 1 files |
| Phase 10-nanoclaw-vps-deployment P02 | 2 | 1 tasks | 1 files |
| Phase 10-nanoclaw-vps-deployment P03 | 4 | 2 tasks | 27 files |
| Phase 10-nanoclaw-vps-deployment P05 | 5 | 1 tasks | 1 files |
| Phase 10-nanoclaw-vps-deployment P06 | 23 | 1 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v2.0 work:

- [v2.0]: Migrate SQLite → Supabase (multi-service access + Realtime subscriptions)
- [v2.0]: NanoClaw fork on VPS — Railway blocks Docker-in-Docker
- [v2.0]: WireGuard tunnel Railway↔VPS; HTTPS+Caddy as fallback if UDP 51820 blocked on Railway
- [v2.0]: SIWE + iron-session v8 (stateless encrypted cookie; no session table in Supabase)
- [v2.0]: SSE direct from NanoClaw for chat streaming; Supabase Realtime only for observability events
- [v1.0/01-01]: wagmi pinned to v2.x — do NOT upgrade to v3 (incompatible with RainbowKit 2.x)
- [09-01]: Composite-PK tables (follows) need onConflict: 'follower_id,following_id' not 'id' in supabase-js upsert
- [09-01]: agents.owner_wallet is nullable text — null for existing agents, SIWE address for new v2.0 agents
- [09-02]: 'use server' directive is for Server Action modules only (async function exports) — use 'server-only' import for files that export plain objects (e.g. supabaseAdmin const)
- [09-02]: requireAgentOwnership() is now async — all callers must await it
- [09-02]: seed() is now async — seed route updated accordingly
- [Phase 09-03]: Deleted src/lib/auth.ts: EIP-191 per-request auth fully replaced by SIWE iron-session
- [Phase 09-03]: requireOwnership() returns 403 when owner_wallet is null — legacy agents must claim ownership before management access
- [Phase 09-03]: Legacy routes (posts, bounties, follows) still check wallet_address for ownership; requireOwnership() migration deferred to Phase 11
- [Phase 09-04]: app/.env.local is a symlink to root .env.local — keeps env vars at root, Next.js reads from app/
- [Phase 09-04]: pnpm.onlyBuiltDependencies moved from app/package.json to root package.json (workspace root requirement)
- [Phase 09-04]: Railway Root Directory must be set to app manually in dashboard — cannot be automated
- [Phase 10-nanoclaw-vps-deployment]: Chose Hetzner CPX22 (Ashburn VA $7.59/mo) over DigitalOcean Basic 4GB ($24/mo) for 3x cost savings
- [Phase 10-nanoclaw-vps-deployment]: HTTPS+Caddy as primary Railway-to-VPS transport; WireGuard optional hardening only after core working
- [Phase 10-nanoclaw-vps-deployment]: HTTPS+Caddy confirmed as primary Railway-to-VPS transport — Railway lacks NET_ADMIN capability (wg-quick returns RTNETLINK Operation not permitted)
- [Phase 10-nanoclaw-vps-deployment]: NanoClaw URL from Railway: https://nanoclaw.<DOMAIN>; auth via x-shared-secret header (32-byte hex); VPS at 146.190.161.168
- [10-03]: NanoClaw upstream: qwibitai/nanoclaw@d768a04 — Channel interface has no sendDone(); done signaled inline in sendMessage() with {done:true} SSE event
- [10-03]: OnInboundMessage signature is (chatJid, NewMessage) not (chatJid, IncomingMessage) — NewMessage is the correct upstream type with id, chat_jid, sender, sender_name, content, timestamp
- [10-03]: setRegisteredGroup takes full RegisteredGroup object (name, folder, trigger, added_at) not just folder string
- [10-03]: ESM module format required in agent-server/ — NodeNext moduleResolution, .js extensions in all imports
- [10-05]: CI/CD workflow deploy-agent.yml placed in agent-server repo (separate git repo), not network/ repo; path filter agent-server/** prevents false triggers on Next.js changes
- [Phase 10]: SSE-first pattern: webapp callers must open /stream/:agentId before POST /message to avoid agent-turn race condition (~300ms container turns)
- [Phase 10]: onRegisterGroup callback pattern: webapp channel uses channelOpts.onRegisterGroup to update in-memory registeredGroups AND DB atomically — direct setRegisteredGroup() only writes DB

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 10]: NanoClaw 2s polling latency may create noticeable chat delay — spike before building chat UI in Phase 13
- [Phase 13]: Claude Agent SDK token streaming through NanoClaw IPC to webapp channel is unconfirmed — may fall back to polling Supabase for completed turns
- [Phase 10]: container/agent-runner/ not implemented — containers spawn but produce no OUTPUT_MARKER output; full Claude SSE response deferred to Phase 13

## Session Continuity

Last session: 2026-03-22
Stopped at: 10-06 Task 2 checkpoint (human-verify) — e2e-test.sh created; 4/4 tests passing; waiting for user to confirm results
Resume file: None
