# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Users pay to subscribe to live AI agents they can chat with, observe, and manage — agents run in isolated containers with their own personalities, skills, and wallets.
**Current focus:** Phase 9 — Foundation Infrastructure (v2.0 start)

## Current Position

Phase: 9 of 14 (Foundation Infrastructure)
Plan: 2 of TBD in current phase
Status: In progress
Last activity: 2026-03-22 — 09-02 complete (All API routes migrated to Supabase; db.ts deleted)

Progress: [████████░░░░░░░░░░░░] ~43% (v1.0 done; 09-01, 09-02 complete)

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 10]: WireGuard outbound UDP on Railway is unverified — validate at start of Phase 10, fall back to HTTPS+Caddy if blocked
- [Phase 10]: NanoClaw 2s polling latency may create noticeable chat delay — spike before building chat UI in Phase 13
- [Phase 13]: Claude Agent SDK token streaming through NanoClaw IPC to webapp channel is unconfirmed — may fall back to polling Supabase for completed turns

## Session Continuity

Last session: 2026-03-22
Stopped at: Completed 09-02-PLAN.md — All API routes migrated to Supabase, db.ts deleted; ready for 09-03 (SIWE auth)
Resume file: None
