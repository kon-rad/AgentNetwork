---
phase: 15-escrow-contract-base-mainnet-deployment
plan: 02
subsystem: api
tags: [escrow, viem, base-mainnet, usdc, api-routes, treasury]

requires:
  - phase: 15-escrow-contract-base-mainnet-deployment
    provides: escrow.ts client with getJob, resolveDispute, refundJob, escrowAbi, JobStatus
provides:
  - Full escrow job lifecycle API (create verify, status read, release, dispute, resolve, refund)
  - Client-signed tx verification endpoints (POST create, release, dispute)
  - Treasury server-side signing endpoints (resolve, refund)
affects: [frontend-escrow-ui, agent-jobs]

tech-stack:
  added: []
  patterns: ["decodeEventLog iteration for event parsing in API routes", "treasury-only authorization via TREASURY_ADDRESS env var"]

key-files:
  created:
    - src/app/api/escrow/route.ts
    - src/app/api/escrow/[jobId]/release/route.ts
    - src/app/api/escrow/[jobId]/dispute/route.ts
    - src/app/api/escrow/[jobId]/resolve/route.ts
    - src/app/api/escrow/[jobId]/refund/route.ts
  modified: []

key-decisions:
  - "Client-signed operations verify tx sender matches session wallet address"
  - "Treasury-only routes check TREASURY_ADDRESS env var for authorization"
  - "BigInt jobId values returned as strings in JSON responses"

patterns-established:
  - "Escrow event parsing: iterate receipt.logs with try/catch decodeEventLog using full escrowAbi"
  - "Treasury authorization: session.address vs TREASURY_ADDRESS env var check"

requirements-completed: [ESC-02, ESC-03, ESC-04]

duration: 2min
completed: 2026-03-22
---

# Phase 15 Plan 02: Escrow API Routes Summary

**Full escrow job lifecycle API with client tx verification, on-chain status reads, and treasury server-side signing for dispute resolution and refunds**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T15:34:16Z
- **Completed:** 2026-03-22T15:37:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- POST /api/escrow verifies client-signed job creation and parses JobCreated event
- GET /api/escrow?jobId=N reads on-chain job status with human-readable status labels
- Release and dispute routes verify client-signed transactions and confirm on-chain status
- Resolve and refund routes execute server-side with TREASURY_PRIVATE_KEY, restricted to treasury wallet

## Task Commits

Each task was committed atomically:

1. **Task 1: Create main escrow route (POST verify + GET status)** - `6c51149` (feat)
2. **Task 2: Create escrow lifecycle routes (release, dispute, resolve, refund)** - `5028ff7` (feat)

## Files Created/Modified
- `src/app/api/escrow/route.ts` - POST verify job creation tx + GET read on-chain job status
- `src/app/api/escrow/[jobId]/release/route.ts` - POST verify client-signed fund release
- `src/app/api/escrow/[jobId]/dispute/route.ts` - POST verify client/agent-signed dispute
- `src/app/api/escrow/[jobId]/resolve/route.ts` - POST treasury dispute resolution (server-side signing)
- `src/app/api/escrow/[jobId]/refund/route.ts` - POST treasury refund (server-side signing)

## Decisions Made
- Client-signed operations (create, release, dispute) verify receipt.from matches session wallet address
- Treasury-only operations (resolve, refund) check session.address against TREASURY_ADDRESS env var before executing
- BigInt values (jobId, amount) serialized as strings in JSON responses for JavaScript compatibility
- JobReleased/JobDisputed events parsed and validated against route param jobId for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. TREASURY_ADDRESS and TREASURY_PRIVATE_KEY env vars assumed already configured from Phase 15-01.

## Next Phase Readiness
- Full escrow API ready for frontend integration
- All 5 route files pass TypeScript type checking
- No baseSepolia references -- all routes target Base mainnet

## Self-Check: PASSED

- All 5 route files exist
- SUMMARY.md exists
- Commits 6c51149 and 5028ff7 verified in git log

---
*Phase: 15-escrow-contract-base-mainnet-deployment*
*Completed: 2026-03-22*
