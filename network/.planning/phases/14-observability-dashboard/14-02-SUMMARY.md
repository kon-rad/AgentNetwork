---
phase: 14-observability-dashboard
plan: "02"
subsystem: api
tags: [express, nanoclaw, nextjs, file-browser, proxy, ownership]

# Dependency graph
requires:
  - phase: 13-live-chat
    provides: requireOwnership guard and NanoClaw shared-secret pattern
  - phase: 10-nanoclaw-vps-deployment
    provides: NanoClaw webapp channel (Express app with shared-secret middleware)
provides:
  - NanoClaw GET /agents/:agentId/files endpoint listing workspace files (2-level deep)
  - Next.js GET /api/agents/[id]/files ownership-gated proxy route
affects: [14-03-observability-dashboard-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolveGroupFolderPath() for path-traversal-safe folder access in NanoClaw"
    - "listDir() recursive helper capped at depth 2 returns FileEntry[] with name/path/type/size/modified"
    - "NanoClaw files proxy: Next.js route fetches NanoClaw with x-shared-secret, returns empty array on error"

key-files:
  created:
    - src/app/api/agents/[id]/files/route.ts
  modified:
    - /Users/konradgnat/dev/startups/network/agent-server/src/channels/webapp/index.ts

key-decisions:
  - "Path traversal prevented at NanoClaw layer by using resolveGroupFolderPath() which calls assertValidGroupFolder() + ensureWithinBase()"
  - "listDir depth capped at >2 (not >=2) — allows depth 0, 1, 2 giving 3 effective levels from root"
  - "NanoClaw returns empty array (not error) when folder missing — agent may not have run yet"
  - "Next.js proxy returns empty array (not 503) when NanoClaw unreachable — graceful degradation"
  - "Shared-secret header uses NANOCLAW_SHARED_SECRET env var (not NANOCLAW_SECRET) — consistent with OBS pattern"

patterns-established:
  - "NanoClaw file listing: resolveGroupFolderPath() validates + resolves, listDir() recurses safely"
  - "Next.js NanoClaw proxy: requireOwnership() first, then fetch with x-shared-secret, catch returns empty not error"

requirements-completed: [OBS-05]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 14 Plan 02: File Browser Backend Summary

**NanoClaw GET /agents/:agentId/files endpoint with 2-level recursive workspace listing and Next.js ownership-gated proxy route**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-22T12:37:31Z
- **Completed:** 2026-03-22T12:39:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `GET /agents/:agentId/files` to NanoClaw webapp channel — lists workspace files up to 2 levels deep with name, relative path, type, size, and mtime
- Path traversal prevention via `resolveGroupFolderPath()` which validates folder name pattern and ensures path stays within GROUPS_DIR
- Created `src/app/api/agents/[id]/files/route.ts` — ownership-gated proxy that forwards to NanoClaw with x-shared-secret header and degrades gracefully to empty array
- Both TypeScript projects compile with 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: NanoClaw GET /agents/:agentId/files endpoint** - `4474a14` (feat)
2. **Task 2: Next.js /api/agents/[id]/files proxy route** - `967e477` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `/Users/konradgnat/dev/startups/network/agent-server/src/channels/webapp/index.ts` - Added `resolveGroupFolderPath` import, `FileEntry` interface, `listDir` helper, and `GET /agents/:agentId/files` route before `app.listen()`
- `src/app/api/agents/[id]/files/route.ts` - New Next.js route: awaits Promise params, calls `requireOwnership`, proxies to NanoClaw, returns `{ files: FileEntry[] }`

## Decisions Made

- Path traversal prevented at NanoClaw layer using existing `resolveGroupFolderPath()` from `group-folder.ts` — validates folder name with regex pattern and `ensureWithinBase()` check
- `listDir` depth guard uses `depth > 2` (not `>= 2`) — allows traversal at depths 0, 1, 2 (3 effective levels)
- Both NanoClaw and Next.js return `{ files: [] }` on errors (missing folder, NanoClaw unreachable) for graceful degradation
- `NANOCLAW_SHARED_SECRET` env var used (not `NANOCLAW_SECRET`) — aligns with observability phase naming

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required beyond existing `NANOCLAW_URL` and `NANOCLAW_SHARED_SECRET` env vars.

## Next Phase Readiness

- File browser API is complete end-to-end; Plan 03 (observability dashboard UI) can call `GET /api/agents/[id]/files` to display workspace files
- `FileEntry` shape: `{ name: string, path: string, type: 'file'|'dir', size?: number, modified?: string }`

---
*Phase: 14-observability-dashboard*
*Completed: 2026-03-22*

## Self-Check: PASSED

- webapp/index.ts: FOUND
- files/route.ts: FOUND
- SUMMARY.md: FOUND
- Commit 4474a14: FOUND
- Commit 967e477: FOUND
