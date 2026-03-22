---
phase: 15-escrow-contract-base-mainnet-deployment
plan: 01
subsystem: payments
tags: [solidity, solc-js, viem, base-mainnet, escrow, usdc, openzeppelin]

requires:
  - phase: 05-x402-payments
    provides: USDC transfer helpers and chain config
provides:
  - solc-js compilation pipeline for AgentEscrow.sol
  - TypeScript escrow client targeting Base mainnet
  - Generated ABI JSON for contract interaction
  - Robust event parsing with decodeEventLog
affects: [15-02, subscriptions, agent-jobs]

tech-stack:
  added: ["@openzeppelin/contracts@5.6.1", "solc@0.8.34"]
  patterns: ["solc-js with findImports callback for npm dependency resolution", "decodeEventLog iteration for event parsing"]

key-files:
  created:
    - src/lib/chain/abi/AgentEscrow.json
  modified:
    - scripts/deploy-escrow.ts
    - src/lib/chain/escrow.ts
    - package.json

key-decisions:
  - "solc-js npm package replaces system solc binary -- no global install needed"
  - "ABI imported from generated JSON file rather than inline definition"
  - "decodeEventLog iteration pattern (matching erc8004.ts) replaces fragile logs[0] parsing"
  - "Added --compile-only flag to deploy script for CI/testing use"

patterns-established:
  - "solc-js compilation: findImports resolves @openzeppelin from node_modules"
  - "Event parsing: iterate receipt.logs with try/catch decodeEventLog (never use log index)"

requirements-completed: [ESC-01, ESC-05]

duration: 4min
completed: 2026-03-22
---

# Phase 15 Plan 01: Escrow Contract Base Mainnet Deployment Summary

**solc-js compilation pipeline with findImports callback, Base mainnet deploy script, and robust decodeEventLog event parsing in escrow.ts client**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T15:27:42Z
- **Completed:** 2026-03-22T15:31:38Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Deploy script rewritten to use solc-js npm package with findImports callback (no system solc binary)
- All chain references switched from baseSepolia to Base mainnet with correct USDC address
- createJob event parsing fixed: decodeEventLog iteration replaces fragile logs[0].topics[1]
- Generated ABI JSON saved to src/lib/chain/abi/AgentEscrow.json
- escrowAbi and ESCROW_ADDRESS exported for API route consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and update deploy script to use solc-js + Base mainnet** - `d201485` (feat)
2. **Task 2: Update escrow.ts client for Base mainnet and fix event parsing** - `5db4f13` (feat)

## Files Created/Modified
- `scripts/deploy-escrow.ts` - Rewritten: solc-js compilation, Base mainnet chain, --compile-only flag
- `src/lib/chain/escrow.ts` - Updated: ABI from JSON import, decodeEventLog parsing, exports
- `src/lib/chain/abi/AgentEscrow.json` - Generated ABI from solc compilation (300 lines)
- `package.json` - Added @openzeppelin/contracts and solc dependencies
- `pnpm-lock.yaml` - Lockfile updated

## Decisions Made
- Used solc-js npm package instead of system solc binary -- eliminates global install requirement
- Added --compile-only flag to deploy script for ABI generation without deployment
- Imported ABI from generated JSON file rather than maintaining inline ABI arrays
- Cast readContract return type explicitly to fix TypeScript inference with JSON ABI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error with JSON ABI readContract return**
- **Found during:** Task 2 (escrow.ts client update)
- **Issue:** readContract return type inferred as `unknown` when using JSON-imported ABI (not `as const`)
- **Fix:** Added explicit tuple cast on readContract result in getJob function
- **Files modified:** src/lib/chain/escrow.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 5db4f13 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type cast necessary for correctness with JSON ABI imports. No scope creep.

## Issues Encountered
- npm install failed due to pnpm symlinks in node_modules -- used pnpm instead (project uses pnpm)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Deploy script ready to run with `npx tsx scripts/deploy-escrow.ts` (needs funded deployer wallet)
- escrow.ts client ready for Base mainnet contract interaction
- ABI file generated and importable by any module

---
*Phase: 15-escrow-contract-base-mainnet-deployment*
*Completed: 2026-03-22*
