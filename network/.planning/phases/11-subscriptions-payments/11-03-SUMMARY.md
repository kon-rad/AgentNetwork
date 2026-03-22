---
phase: 11-subscriptions-payments
plan: 03
subsystem: payments
tags: [usdc, wagmi, viem, base, erc20, subscription, react, state-machine]

# Dependency graph
requires:
  - phase: 11-subscriptions-payments/11-01
    provides: subscriptions table schema and DB migrations
  - phase: 11-subscriptions-payments/11-02
    provides: POST /api/subscriptions and GET /api/subscriptions/[agentId] API routes

provides:
  - /subscribe/[agentId] page with 6-state USDC payment state machine
  - SubscriptionStatus badge component for agent profile pages
  - Agent profile integration showing subscription status with expiry

affects: [13-agent-chat, 12-agent-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 6-state payment state machine (idle/prompting/pending/confirming/launching/error)
    - useWriteContract + useWaitForTransactionReceipt paired with useEffect state transitions
    - NEXT_PUBLIC_TREASURY_ADDRESS for client-side env var (vs server-side TREASURY_ADDRESS)

key-files:
  created:
    - src/app/subscribe/[agentId]/page.tsx
    - src/components/profile/subscription-status.tsx
  modified:
    - src/app/agent/[id]/page.tsx
    - src/lib/autonomous/runner.ts

key-decisions:
  - "State machine driven by useEffect watching txHash/isConfirmed — avoids inline callback complexity"
  - "SubscriptionStatus fetches on mount with no wallet required — public endpoint shows has_active only"

patterns-established:
  - "Payment state machine: useEffect chain (txHash → pending, isConfirmed → confirming → launching)"
  - "Public subscription badge: fetch on mount, shimmer loading, active badge vs subscribe link"

requirements-completed: [PAY-01, PAY-02, SUB-01, SUB-03]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 11 Plan 03: Subscribe Page & Subscription Badge Summary

**100 USDC subscription flow via wagmi erc20 transfer with 6-state UI and agent profile subscription badge**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T11:36:12Z
- **Completed:** 2026-03-22T11:39:00Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Subscribe page at /subscribe/[agentId] with full 6-state payment state machine (idle/prompting/pending/confirming/launching/error)
- USDC transfer via wagmi useWriteContract driving 100 USDC to NEXT_PUBLIC_TREASURY_ADDRESS on Base
- BaseScan tx link shown in pending state; POST /api/subscriptions called on confirmation
- SubscriptionStatus component on agent profiles — active badge with expiry or subscribe link
- Renew flow for existing active subscribers

## Task Commits

Each task was committed atomically:

1. **Task 1: Subscribe page with 6-state USDC payment state machine** - `ee02922` (feat)
2. **Task 2: SubscriptionStatus badge component + agent profile integration** - `2003b4a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/subscribe/[agentId]/page.tsx` - Full subscribe page with state machine, wagmi hooks, and agent/subscription fetching
- `src/components/profile/subscription-status.tsx` - Badge component: active expiry or subscribe link, shimmer loading
- `src/app/agent/[id]/page.tsx` - Added SubscriptionStatus import and component below follow/stats
- `src/lib/autonomous/runner.ts` - Fixed missing privateKey argument to registerIdentityAction (Rule 1 bug)

## Decisions Made
- State machine driven by useEffect chains watching wagmi hook outputs — avoids complex callback nesting
- NEXT_PUBLIC_TREASURY_ADDRESS used client-side for wagmi call; server-side TREASURY_ADDRESS used in API route
- SubscriptionStatus uses public API endpoint (no auth required) — returns has_active/expires_at only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing privateKey argument in runner.ts registerIdentityAction call**
- **Found during:** Task 2 (pnpm build verification)
- **Issue:** `registerIdentityAction(agent, log)` called with 2 args; function signature requires 3 (agent, log, privateKey) — caused TypeScript build failure
- **Fix:** Added `privateKey` from `process.env.FILECOIN_PRIVATE_KEY` with fallback to a zero-value key for demo mode
- **Files modified:** src/lib/autonomous/runner.ts
- **Verification:** pnpm build passes
- **Committed in:** 2003b4a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Pre-existing build-blocking bug unrelated to subscription feature. Fix uses existing FILECOIN_PRIVATE_KEY env var already required by the autonomous loop.

## Issues Encountered
- Build was blocked by a pre-existing TypeScript error in runner.ts (Phase 8 regression). Fixed inline per Rule 1.

## User Setup Required
- Ensure `NEXT_PUBLIC_TREASURY_ADDRESS` is set in .env.local for client-side USDC transfers to work
- This is the same address as server-side `TREASURY_ADDRESS` but must be prefixed with `NEXT_PUBLIC_`

## Next Phase Readiness
- Subscribe page and badge ready for human verification (Task 3 checkpoint)
- After verification: Phase 11-04 (subscription management dashboard) can proceed
- pnpm build passes cleanly

---
*Phase: 11-subscriptions-payments*
*Completed: 2026-03-22*
