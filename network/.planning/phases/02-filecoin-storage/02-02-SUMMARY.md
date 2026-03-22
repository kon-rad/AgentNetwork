---
phase: 02-filecoin-storage
plan: "02"
subsystem: api
tags: [filecoin, synapse-sdk, sqlite, next-api-routes, server-only]

# Dependency graph
requires:
  - phase: 02-filecoin-storage
    plan: "01"
    provides: uploadToFilecoin/downloadFromFilecoin adapter, FilecoinUploadResult/FilecoinUploadRecord types, filecoin_uploads SQLite table
provides:
  - POST /api/chain/upload — upload agent_card, agent_log, or nft_metadata to Filecoin with DB tracking
  - GET /api/chain/download/[cid] — retrieve Filecoin content by PieceCID (immutable cache headers)
  - GET /api/agents/[id]/filecoin — list all Filecoin uploads for an agent with optional type filter
affects:
  - 03-erc8004 (uses pieceCid from upload route as agentURI)
  - 05-nft-minting (calls upload route with type=nft_metadata)
  - 08-autonomous-agent-loop (calls upload route with type=agent_card and agent_log)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js 16 async params pattern: await params before extracting dynamic segments"
    - "Cache-Control: public, max-age=31536000, immutable on Filecoin download — content is content-addressed and immutable by CID"
    - "crypto.randomUUID() used for DB record IDs (no uuid package needed in Next.js 16+)"

key-files:
  created:
    - src/app/api/chain/upload/route.ts
    - src/app/api/chain/download/[cid]/route.ts
    - src/app/api/agents/[id]/filecoin/route.ts
  modified: []

key-decisions:
  - "Return 502 (not 500) for Filecoin SDK/upload failures — distinguishes upstream service failure from internal errors"
  - "Agent card re-uploads are allowed (cards can be updated); existing CID logged at server level but not blocked"
  - "Download route returns 404 for any SDK error — CID-not-found and network errors are indistinguishable to callers"
  - "Agent filecoin list returns empty array (not 404) when agent has no uploads — empty is valid state"
  - "crypto.randomUUID() used instead of uuid package — available natively in Node.js 16+ and Next.js runtime"

patterns-established:
  - "Pattern: API routes consume filecoin.ts adapter functions — never import synapse-sdk directly in routes"
  - "Pattern: Upload route validates type/agentId/data with early returns before calling async Filecoin operations"

requirements-completed: [FIL-01, FIL-02, FIL-03]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 2 Plan 02: Filecoin Upload API Routes Summary

**Three Next.js API routes wiring the Filecoin adapter to HTTP: upload endpoint with SQLite tracking, CID-based download with immutable cache headers, and per-agent upload list with type filtering**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-20T03:33:00Z
- **Completed:** 2026-03-20T03:41:27Z
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments
- Created POST /api/chain/upload with validation for all three upload types and SQLite persistence
- Created GET /api/chain/download/[cid] with immutable Cache-Control headers for Filecoin content
- Created GET /api/agents/[id]/filecoin with optional ?type= filter for upload history
- All three routes pass tsc and pnpm build cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create upload API route with DB tracking** - `f35e698` (feat)
2. **Task 2: Create download and agent uploads list routes** - `65d3b42` (feat)

## Files Created/Modified
- `src/app/api/chain/upload/route.ts` - POST endpoint for uploading agent_card/agent_log/nft_metadata to Filecoin; validates input, calls uploadToFilecoin, persists to filecoin_uploads table
- `src/app/api/chain/download/[cid]/route.ts` - GET endpoint to retrieve Filecoin content by PieceCID; returns 200 with content and immutable cache header, 404 on error
- `src/app/api/agents/[id]/filecoin/route.ts` - GET endpoint listing all Filecoin uploads for an agent; supports optional ?type= query param filter

## Decisions Made
- **502 for Filecoin SDK failures:** Upload route returns 502 (Bad Gateway) when uploadToFilecoin throws, distinguishing upstream Filecoin service failure from internal server errors (500).
- **Agent card re-uploads allowed:** Re-uploading agent_card for the same agent is permitted (cards can be versioned); previous CID is logged server-side but not blocked.
- **crypto.randomUUID() over uuid package:** Node.js 16+ has `crypto.randomUUID()` built-in; no need to import the uuid package that was noted as "already in project deps" — native is cleaner.
- **Empty array for no uploads:** Agent filecoin list returns `[]` (not 404) when an agent has no uploads — empty is a valid state for a new agent.

## Deviations from Plan

None - plan executed exactly as written. The plan mentioned checking for `uuid` package or using `crypto.randomUUID()` — opted for `crypto.randomUUID()` which is native to Node.js 16+ and requires no import.

## Issues Encountered
None. tsc and pnpm build passed on first attempt for both tasks.

## User Setup Required
None - no additional external service configuration required. Wallet funding prerequisite documented in 02-01 USER-SETUP.

## Next Phase Readiness
- Phase 3 (ERC-8004): Can call `POST /api/chain/upload` with `type=agent_card` to get a pieceCid for use as agentURI in the ERC-8004 registration contract
- Phase 6 (NFT minting): Can call `POST /api/chain/upload` with `type=nft_metadata` before minting
- Phase 8 (autonomous agent loop): Can call `POST /api/chain/upload` with `type=agent_log` to record execution history on-chain
- Wallet funding remains prerequisite — actual uploads will fail until tFIL and tUSDFC are funded (see 02-01 plan notes)

---
*Phase: 02-filecoin-storage*
*Completed: 2026-03-20*
