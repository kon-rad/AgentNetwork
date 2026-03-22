---
phase: 11-subscriptions-payments
plan: 02
subsystem: api
tags: [viem, base, usdc, subscriptions, nanoclaw, payments]

# Dependency graph
requires:
  - phase: 11-01
    provides: subscriptions table DDL + Subscription TypeScript type

provides:
  - POST /api/subscriptions — on-chain USDC payment verification + subscription creation
  - GET /api/subscriptions/[agentId] — subscription status lookup (authenticated + public)

affects: [phase-12, phase-13, agent-profile-page, chat-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "viem publicClient.getTransactionReceipt + decodeEventLog for on-chain tx verification"
    - "Fire-and-forget NanoClaw registration after successful payment (non-fatal)"
    - "Unauthenticated public status shape { has_active, expires_at } vs authenticated full row"

key-files:
  created:
    - src/app/api/subscriptions/route.ts
    - src/app/api/subscriptions/[agentId]/route.ts
  modified: []

key-decisions:
  - "owner_wallet stored as lowercased address for consistent equality checks (session.address.toLowerCase())"
  - "Duplicate tx_hash checked pre-insert AND handled via Postgres 23505 error code for race-condition safety"
  - "Unauthenticated GET returns { has_active, expires_at } without wallet address (privacy-safe agent badges)"
  - "NanoClaw registration is fire-and-forget — subscription row is always created even if NanoClaw is unreachable"

patterns-established:
  - "requireAuth() pattern: if (sessionOrError instanceof Response) return sessionOrError"
  - "On-chain verification: receipt.status === 'success' + Transfer log decode + to/value/from assertions"

requirements-completed: [PAY-03, PAY-04, SUB-02, SUB-03]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 11 Plan 02: Subscriptions Payments API Summary

**On-chain USDC payment verification via viem on Base mainnet with subscription creation and NanoClaw group registration**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-22T18:52:43Z
- **Completed:** 2026-03-22T18:54:23Z
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments
- POST /api/subscriptions verifies USDC tx on Base mainnet (receipt, Transfer log decode, to/value/sender checks) and inserts 30-day subscription
- GET /api/subscriptions/[agentId] returns full row to authenticated owners and public { has_active, expires_at } to unauthenticated callers
- NanoClaw /register-group called after successful payment as fire-and-forget (non-fatal failure)
- Duplicate tx_hash rejected with 409 both pre-insert check and Postgres 23505 error code handler (race-condition safe)

## Task Commits

Each task was committed atomically:

1. **Task 1: POST /api/subscriptions payment verification route** - `c5bfde7` (feat)
2. **Task 2: GET /api/subscriptions/[agentId] subscription status route** - `0ba09c5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/subscriptions/route.ts` - POST payment verification: viem tx check, USDC transfer decode, subscription insert, NanoClaw registration
- `src/app/api/subscriptions/[agentId]/route.ts` - GET subscription status: full row for authenticated owner, public aggregate for unauthenticated callers

## Decisions Made
- `owner_wallet` stored lowercased to avoid case-sensitivity issues when comparing against session.address
- Dual duplicate guard: pre-insert query + Postgres 23505 error code handler ensures no race condition double-spend
- Public GET returns `{ has_active, expires_at }` (not full row) — avoids leaking owner wallet addresses to arbitrary callers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `src/lib/autonomous/runner.ts` (unrelated, out of scope). New subscription route files compile with no errors.

## User Setup Required

The following environment variables must be set in `.env.local` before the payment flow works:

- `TREASURY_ADDRESS` — checksummed Ethereum wallet address for USDC receipts
- `NANOCLAW_URL` — NanoClaw VPS URL (e.g. http://146.190.161.168)
- `NANOCLAW_SHARED_SECRET` — 32-byte hex shared secret configured on NanoClaw VPS

(These were documented in 11-01 user setup; same env vars apply here.)

## Next Phase Readiness
- Payment verification and subscription management API ready for frontend integration
- Agent profile page can call GET /api/subscriptions/[agentId] without auth for subscription badge display
- Chat UI (Phase 13) can gate access behind GET /api/subscriptions/[agentId] subscription check

---
*Phase: 11-subscriptions-payments*
*Completed: 2026-03-22*
