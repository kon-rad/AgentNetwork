---
phase: 15-chat-history
plan: "02"
subsystem: api
tags: [supabase, sessions, chat, rest-api, next-js]

# Dependency graph
requires:
  - phase: 15-01
    provides: chat_sessions table migration and ChatSession TypeScript types
provides:
  - GET /api/agents/[id]/sessions — list sessions ordered by last_message_at DESC with synthetic __legacy__ entry for orphaned messages
  - POST /api/agents/[id]/sessions — create a new chat session
  - GET /api/agents/[id]/sessions/[sessionId] — return per-session messages ordered by created_at ASC
  - Modified POST /api/agents/[id]/chat — accepts optional session_id, persists it on messages, updates session metadata
affects:
  - 15-03 (sidebar UI will call these routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "await params pattern for Next.js async route params"
    - "requireOwnership guard used in all session routes"
    - "Synthetic session ID __legacy__ for backward-compatible orphaned message access"
    - "Fire-and-forget session metadata update (last_message_at, auto-title)"

key-files:
  created:
    - src/app/api/agents/[id]/sessions/route.ts
    - src/app/api/agents/[id]/sessions/[sessionId]/route.ts
  modified:
    - src/app/api/agents/[id]/chat/route.ts

key-decisions:
  - "__legacy__ synthetic session ID maps to session_id=NULL rows — no migration needed for pre-existing chat messages"
  - "Session title auto-set from first 60 chars of first user message when title is null"
  - "Session metadata updates (last_message_at, title) are non-fatal best-effort operations after successful message insert"

patterns-established:
  - "Synthetic session ID pattern: __legacy__ is a reserved string that maps to IS NULL filter on session_id"
  - "Auto-title on first message: check title IS NULL then update — avoids overwriting user-set titles"

requirements-completed:
  - HIST-02
  - HIST-05

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 15 Plan 02: Session API Routes Summary

**Three REST API routes wiring chat_sessions to the frontend: list/create sessions, per-session message retrieval, and session-aware message posting with auto-title on first message**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T02:44:42Z
- **Completed:** 2026-03-24T02:49:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created GET + POST `/api/agents/[id]/sessions` with orphaned-message legacy entry support
- Created GET `/api/agents/[id]/sessions/[sessionId]` with `__legacy__` synthetic session handling
- Modified POST `/api/agents/[id]/chat` to accept `session_id`, persist it, and update session metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Create session list and create routes** - `f5e3f7e` (feat)
2. **Task 2: Modify chat POST route for session_id support** - `7f70e9e` (feat)

## Files Created/Modified
- `src/app/api/agents/[id]/sessions/route.ts` - GET lists sessions (+ legacy entry), POST creates session
- `src/app/api/agents/[id]/sessions/[sessionId]/route.ts` - GET returns messages for a session (handles __legacy__)
- `src/app/api/agents/[id]/chat/route.ts` - POST now accepts optional session_id, updates session metadata post-insert

## Decisions Made
- The `__legacy__` synthetic session ID is a reserved string mapped to `IS NULL` filter in both the list and message routes — no backfill migration needed
- Session title auto-set to first 60 chars of first user message. Subsequent messages skip the update because the title is no longer null
- Session metadata updates (last_message_at, title check+set) happen after successful message insert; failures are non-fatal since message is already persisted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three API routes compile and are ready for consumption by the sidebar UI (Phase 15 Plan 03)
- `__legacy__` session bridging enables legacy chat history to appear in the sidebar without data migration

---
*Phase: 15-chat-history*
*Completed: 2026-03-24*
