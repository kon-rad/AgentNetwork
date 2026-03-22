---
phase: 13-live-chat
plan: "02"
subsystem: api
tags: [supabase, nanoclaw, sse, chat, streaming, next.js]

# Dependency graph
requires:
  - phase: 13-live-chat
    provides: chat_messages Supabase table, NanoClaw integration patterns (13-01)
provides:
  - GET /api/agents/[id]/chat — message history from chat_messages ordered by created_at
  - POST /api/agents/[id]/chat — persists user message and forwards to NanoClaw /message
  - GET /api/agents/[id]/chat/stream — SSE proxy from NanoClaw /stream/:agentId to browser
affects: [13-03-chat-ui, any plan referencing chat API endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - requireOwnership ownership guard on all chat routes
    - NanoClaw fire-and-forget forward pattern (non-fatal failure)
    - Direct ReadableStream pipe for SSE proxy (no buffering)
    - Synthetic SSE error events when upstream unavailable

key-files:
  created:
    - src/app/api/agents/[id]/chat/route.ts
    - src/app/api/agents/[id]/chat/stream/route.ts
  modified: []

key-decisions:
  - "NanoClaw forward in POST is fire-and-forget: message persists even if NanoClaw unreachable; stream will surface error to UI"
  - "SSE proxy uses direct body pipe (upstreamResponse.body) for zero-buffering passthrough; synthetic error events when upstream fails"
  - "Stream route does NOT write to Supabase to avoid double-write race with UI (13-03 handles assistant message persistence after response event)"

patterns-established:
  - "Chat route pattern: requireOwnership guard → Supabase query/insert → NanoClaw forward"
  - "SSE proxy pattern: requireOwnership → fetch upstream SSE → pipe body with SSE headers"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 13 Plan 02: Live Chat API Routes Summary

**Three Next.js API routes wiring Supabase chat persistence and NanoClaw SSE proxy: GET/POST history+send and GET stream proxy with ownership enforcement on all routes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T12:17:51Z
- **Completed:** 2026-03-22T12:19:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GET /api/agents/[id]/chat returns full message history from chat_messages ordered ascending by created_at
- POST /api/agents/[id]/chat persists user message to Supabase then forwards to NanoClaw (non-fatal if NanoClaw fails)
- GET /api/agents/[id]/chat/stream proxies NanoClaw SSE endpoint to browser with correct SSE headers
- All three routes enforce ownership via requireOwnership(agentId)
- TypeScript compiles cleanly (npx tsc --noEmit: 0 errors), pnpm build passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Chat history + send message route (GET + POST)** - `1751297` (feat)
2. **Task 2: SSE stream proxy route (GET)** - `000a3f3` (feat)

**Plan metadata:** (final docs commit)

## Files Created/Modified
- `src/app/api/agents/[id]/chat/route.ts` - GET message history + POST send message, both ownership-guarded
- `src/app/api/agents/[id]/chat/stream/route.ts` - SSE proxy to NanoClaw /stream/:agentId, ownership-guarded

## Decisions Made
- NanoClaw forward in POST is fire-and-forget: message persists in Supabase even if NanoClaw is unreachable; the SSE stream will surface any agent-side error to the UI
- SSE proxy pipes `upstreamResponse.body` directly to the browser with no additional buffering; synthetic SSE error events are emitted when NanoClaw is unavailable or misconfigured
- Stream route does NOT write to Supabase (pure proxy) to avoid double-write race — 13-03 UI will insert the assistant message to chat_messages after receiving a `response` SSE event

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — NANOCLAW_URL and NANOCLAW_SECRET already expected in .env.local per additional context.

## Next Phase Readiness
- Chat API routes are complete and ownership-enforced; 13-03 chat UI can reference all three endpoints
- GET /api/agents/[id]/chat for loading history
- POST /api/agents/[id]/chat for sending messages
- GET /api/agents/[id]/chat/stream for receiving SSE events (thinking, tool_use, response, done)

---
*Phase: 13-live-chat*
*Completed: 2026-03-22*
