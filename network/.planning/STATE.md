# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Users pay to subscribe to live AI agents they can chat with, observe, and manage — agents run in isolated containers with their own personalities, skills, and wallets.
**Current focus:** Phase 14 — Observability Dashboard (Plan 1 of 3 complete; agent_events table migration and AgentEvent type created)

## Current Position

Phase: 14 of 14 (Observability Dashboard)
Plan: 1 of 3 complete in current phase
Status: 14-01 complete — agent_events migration + AgentEvent type ready; migration must be applied via Supabase SQL Editor before proceeding to 14-02
Last activity: 2026-03-22 — 14-01 complete (agent_events SQL migration + AgentEvent TypeScript interface)

Progress: [████████████░░░░░░░░] ~68% (v1.0 done; Phase 09-13 in progress)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 20
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
| Phase 11-subscriptions-payments P01 | 2 | 2 tasks | 2 files |
| Phase 11-subscriptions-payments P02 | 2 | 2 tasks | 2 files |
| Phase 11-subscriptions-payments P03 | 3 | 2 tasks | 4 files |
| Phase 12-agent-templates-skills P01 | 2 | 2 tasks | 2 files |
| Phase 12-agent-templates-skills P02 | 3 | 2 tasks | 12 files |
| Phase 12-agent-templates-skills P03 | 3 | 2 tasks | 3 files |
| Phase 13-live-chat P01 | 1 | 2 tasks | 2 files |
| Phase 13-live-chat P02 | 2 | 2 tasks | 2 files |
| Phase 13-live-chat P03 | 2 | 1 tasks | 1 files |
| Phase 14-observability-dashboard P01 | 1 | 2 tasks | 2 files |

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
- [Phase 10-nanoclaw-vps-deployment]: Chose Hetzner CPX22 (Ashburn VA $7.59/mo) over DigitalOcean Basic 4GB
- [Phase 13-02]: NanoClaw forward in POST chat is fire-and-forget — message persists in Supabase even if NanoClaw unreachable
- [Phase 13-02]: SSE proxy (stream route) does NOT write to Supabase — pure passthrough to avoid double-write race with UI
- [Phase 13-02]: Synthetic SSE error events emitted when NanoClaw unavailable, so UI always receives a done event
- [Phase 13-live-chat]: EventSource closed+reopened after done event for multi-turn chat; streamingContentRef avoids stale closure; optimistic status=thinking on send
- [Phase 14-observability-dashboard]: Migration must be applied via Supabase dashboard SQL Editor
- [Phase 14-observability-dashboard]: payload in AgentEvent typed as Record<string, unknown> — per-event_type sub-types NOT in types.ts

### Blockers

None.

### Session

Last session: 2026-03-22
Stopped at: Completed 14-01-PLAN.md — agent_events migration ready to apply; proceed to 14-02 after applying migration
