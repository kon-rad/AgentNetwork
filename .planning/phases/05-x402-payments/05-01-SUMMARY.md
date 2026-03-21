---
phase: 05-x402-payments
plan: 01
subsystem: payments
tags: [x402, usdc, erc-20, viem, base-sepolia, http-402]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: DB schema with agents.wallet_address, bounties.tx_hash
  - phase: 03-erc-8004-identity
    provides: Chain module patterns (erc8004.ts) for viem client setup
provides:
  - x402 server setup with facilitator client and ExactEvmScheme
  - x402 paying fetch wrapper factory for autonomous agent payments
  - USDC ERC-20 transfer helper for bounty payouts on Base Sepolia
  - x402-gated agent service endpoint at /api/agents/[id]/service
affects: [05-x402-payments plan 02, bounty-completion, agent-services]

# Tech tracking
tech-stack:
  added: ["@x402/next@2.7.0", "@x402/core@2.7.0", "@x402/fetch@2.7.0", "@x402/evm@2.7.0"]
  patterns: [x402-withX402-route-wrapping, paying-fetch-factory, usdc-simulate-then-write]

key-files:
  created:
    - src/lib/x402/server.ts
    - src/lib/x402/client.ts
    - src/lib/chain/usdc.ts
    - src/app/api/agents/[id]/service/route.ts
  modified:
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "withX402 handler takes single NextRequest arg -- extract agent ID from URL path segments"
  - "Single operator wallet (AGENT_PAYMENT_ADDRESS) for x402 payTo -- per-agent dynamic payTo unverified"
  - "USDC transfer uses simulateContract before writeContract -- validates transfer will succeed before spending gas"

patterns-established:
  - "x402 server singleton: import from @/lib/x402/server for all withX402-wrapped routes"
  - "URL path parsing for withX402 handlers: extract dynamic segments from req.nextUrl.pathname"
  - "server-only import on all chain/x402 modules to prevent client-side private key leakage"

requirements-completed: [PAY-01, PAY-02, PAY-03]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 5 Plan 1: x402 Payment Infrastructure Summary

**x402 server/client payment modules with USDC transfer helper and withX402-gated agent service endpoint on Base Sepolia**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T04:03:05Z
- **Completed:** 2026-03-21T04:06:45Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Installed @x402/next, @x402/core, @x402/fetch, @x402/evm packages (v2.7.0)
- Created x402 server setup, client paying fetch factory, and USDC transfer helper -- all with server-only guards
- Created x402-gated GET /api/agents/[id]/service endpoint returning 402 without payment

## Task Commits

Each task was committed atomically:

1. **Task 1: Install x402 packages and create server/client/USDC modules** - `8be405a` (feat)
2. **Task 2: Create x402-gated agent service endpoint** - `5186c01` (feat)

## Files Created/Modified
- `src/lib/x402/server.ts` - x402ResourceServer singleton with facilitator client and ExactEvmScheme
- `src/lib/x402/client.ts` - createPayingFetch factory wrapping fetch with x402 payment handling
- `src/lib/chain/usdc.ts` - transferUsdc helper for ERC-20 USDC transfers on Base Sepolia
- `src/app/api/agents/[id]/service/route.ts` - withX402-wrapped GET handler for agent service data
- `package.json` - Added x402 dependencies
- `pnpm-lock.yaml` - Lock file updated

## Decisions Made
- withX402 expects `(NextRequest) => NextResponse` signature (single argument) -- extract agent ID from URL path segments instead of Next.js route params
- Single operator wallet (AGENT_PAYMENT_ADDRESS env var) used for payTo in withX402 config -- per-agent dynamic payTo is unverified per research
- USDC transfer uses simulateContract before writeContract to validate transfer will succeed before spending gas

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed withX402 handler signature mismatch**
- **Found during:** Task 2 (x402-gated agent service endpoint)
- **Issue:** Plan specified handler with (req, { params }) signature but withX402 expects single NextRequest argument
- **Fix:** Changed handler to accept single NextRequest, extract agent ID from req.nextUrl.pathname
- **Files modified:** src/app/api/agents/[id]/service/route.ts
- **Verification:** pnpm build passes
- **Committed in:** 5186c01 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for type compatibility. No scope creep.

## Issues Encountered
- `npx tsc --noEmit` fails on third-party types in node_modules (ox package BigInt literal errors) but `pnpm build` succeeds -- Next.js compiler handles these correctly

## User Setup Required

Environment variables needed:
- `AGENT_PAYMENT_ADDRESS` - Operator wallet address receiving x402 payments
- `BOUNTY_PAYER_PRIVATE_KEY` - Private key for wallet that sends USDC bounty payouts

## Next Phase Readiness
- x402 server module ready for additional withX402-wrapped routes
- Client paying fetch factory ready for agent-to-agent autonomous payments
- USDC transfer helper ready for bounty completion payment flow

---
*Phase: 05-x402-payments*
*Completed: 2026-03-21*
