---
phase: 04-clanker-tokens
plan: 02
subsystem: ui
tags: [token-display, uniswap-v4, basescan, base, erc-20, profile-page]

requires:
  - phase: 04-clanker-tokens
    provides: Clanker chain module with token deployment and URL helpers (getTokenSwapUrl, getBaseScanTokenUrl)
provides:
  - TokenInfo component displaying ERC-20 token symbol, contract address, Uniswap swap link, BaseScan link
  - Agent profile page integration with token info card and actionable Buy button
affects: [08-autonomous-loop]

tech-stack:
  added: []
  patterns: [conditional link rendering based on token deployment status, 3-column identity grid]

key-files:
  created:
    - src/components/profile/token-info.tsx
  modified:
    - src/app/agent/[id]/page.tsx

key-decisions:
  - "TokenInfo returns null when both tokenSymbol and tokenAddress are null -- no empty card for agents without token config"
  - "Buy button uses <a> tag (not button) when token is deployed -- direct Uniswap navigation without JS handler"
  - "Stats row token symbol links to BaseScan only when token_address exists -- avoids dead links for undeployed tokens"

patterns-established:
  - "Conditional link rendering: deployed tokens get clickable links, undeployed get static text or disabled buttons"

requirements-completed: [TOK-02, TOK-03]

duration: 2min
completed: 2026-03-21
---

# Phase 4 Plan 02: Token Info Display and Trade Links Summary

**TokenInfo glass-card component with Uniswap V4 swap link and BaseScan contract link integrated into agent profile page**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T03:48:06Z
- **Completed:** 2026-03-21T03:50:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- TokenInfo component with 3 states: deployed (full card with links), pending (symbol only), and null (no render)
- Agent profile identity grid expanded to 3 columns with TokenInfo as third card
- Buy button in profile header links to Uniswap V4 swap on Base when token is deployed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TokenInfo component** - `25068ef` (feat)
2. **Task 2: Integrate TokenInfo into agent profile page** - `25faab8` (feat)

## Files Created/Modified
- `src/components/profile/token-info.tsx` - Glass-card component displaying token symbol, contract address, Uniswap buy link, and BaseScan link
- `src/app/agent/[id]/page.tsx` - Updated with TokenInfo import, 3-col identity grid, Uniswap-linked buy button, BaseScan-linked token symbol

## Decisions Made
- TokenInfo returns null when both props are null -- no empty card clutter for agents without tokens
- Buy button renders as `<a>` tag when deployed (direct navigation) vs disabled `<button>` when pending
- Token symbol in stats row is a BaseScan link only when token_address exists to avoid dead links

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (Clanker Tokens) is complete: deployment routes (plan 01) and UI display (plan 02) are both done
- Token deployment requires funded wallet on Base mainnet (documented in 04-01-SUMMARY.md)
- Ready for Phase 5 (Rare Protocol NFTs)

---
*Phase: 04-clanker-tokens*
*Completed: 2026-03-21*
