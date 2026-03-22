---
phase: 04-clanker-tokens
plan: 01
subsystem: api
tags: [clanker-sdk, erc-20, base, uniswap-v4, viem, token-deployment]

requires:
  - phase: 03-erc-8004-identity
    provides: server-only chain module pattern (erc8004.ts), agents table with token_address column
provides:
  - Clanker chain module (deployAgentToken, getTokenSwapUrl, getBaseScanTokenUrl)
  - POST /api/chain/deploy-token endpoint for single agent token deployment
  - POST /api/chain/deploy-all-tokens endpoint for batch sequential deployment
affects: [04-clanker-tokens, 08-autonomous-loop]

tech-stack:
  added: [clanker-sdk@4.2.14]
  patterns: [server-only chain module with viem on Base mainnet, sequential batch deployment with per-item error handling]

key-files:
  created:
    - src/lib/chain/clanker.ts
    - src/app/api/chain/deploy-token/route.ts
    - src/app/api/chain/deploy-all-tokens/route.ts
  modified: []

key-decisions:
  - "Import Clanker from clanker-sdk/v4 (not top-level) -- Clanker class lives in v4 subpath export"
  - "SDK deploy() method returns { txHash, waitForTransaction } -- must await waitForTransaction for token address"
  - "Pool uses POOL_POSITIONS.Standard from clanker-sdk presets -- avoids manual tick configuration"
  - "Vault lockupDuration in seconds (not durationInDays) -- SDK v4 API changed from research"

patterns-established:
  - "Clanker chain module: server-only, Base mainnet (8453), same AGENT_PRIVATE_KEY as erc8004.ts"
  - "Token deploy routes: 409 for already-deployed, 502 for SDK failures, sequential batch to avoid nonce conflicts"

requirements-completed: [TOK-01, TOK-04]

duration: 4min
completed: 2026-03-21
---

# Phase 4 Plan 01: Clanker Token Deployment Summary

**Clanker SDK v4 chain module with single and batch ERC-20 token deployment routes on Base mainnet**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T03:42:05Z
- **Completed:** 2026-03-21T03:46:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Server-only Clanker chain module with deployAgentToken, getTokenSwapUrl, getBaseScanTokenUrl exports
- Single-deploy API route with 404/400/409/502 error handling
- Batch-deploy API route with sequential execution and per-agent error isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Clanker chain module and install SDK** - `6b7ad3a` (feat)
2. **Task 2: Create deploy-token and deploy-all-tokens API routes** - `1d5ca7d` (feat)

## Files Created/Modified
- `src/lib/chain/clanker.ts` - Server-only Clanker SDK wrapper with token deployment and URL helpers
- `src/app/api/chain/deploy-token/route.ts` - POST endpoint to deploy a single agent token
- `src/app/api/chain/deploy-all-tokens/route.ts` - POST endpoint to deploy all agent tokens sequentially

## Decisions Made
- Import from `clanker-sdk/v4` (not top-level) since `Clanker` class is only exported from v4 subpath
- SDK `deploy()` returns `{ txHash, waitForTransaction }` union -- must check for error and await `waitForTransaction()` for the token address
- Used `POOL_POSITIONS.Standard` preset from clanker-sdk instead of manual tick config
- `vault.lockupDuration` is in seconds (SDK v4 API differs from research which showed `durationInDays`)
- `rewards.recipients` array with `bps: 10000` (100%) to deployer, `token: 'Both'` for both paired and clanker rewards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SDK API differs from research documentation**
- **Found during:** Task 1 (Clanker chain module)
- **Issue:** Research showed `clanker.deployToken()` with `pool.quoteToken`, `pool.initialMarketCap`, `vault.durationInDays`, `devBuy`, `rewardsConfig` fields. Actual SDK v4.2.14 uses `clanker.deploy()` with `pool.pairedToken`, `pool.positions`, `vault.lockupDuration`, and `rewards.recipients` array.
- **Fix:** Inspected SDK type definitions and adapted to actual v4 API schema
- **Files modified:** src/lib/chain/clanker.ts
- **Verification:** `tsc --noEmit` and `pnpm build` pass
- **Committed in:** 6b7ad3a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** SDK API adaptation was necessary for correctness. No scope creep.

## Issues Encountered
None beyond the SDK API differences documented above.

## User Setup Required
AGENT_PRIVATE_KEY wallet must have ETH on Base mainnet (chain 8453) for gas. Budget ~0.05 ETH for all 5 token deploys.

## Next Phase Readiness
- Chain module and API routes ready for plan 04-02 (token info display and Uniswap trade link on agent profile)
- Actual token deployment requires funded wallet on Base mainnet

---
*Phase: 04-clanker-tokens*
*Completed: 2026-03-21*
