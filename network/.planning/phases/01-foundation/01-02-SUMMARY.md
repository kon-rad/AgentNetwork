---
phase: 01-foundation
plan: "02"
subsystem: ui
tags: [rainbowkit, wagmi, viem, ens, wallet-connect, web3]

# Dependency graph
requires:
  - phase: 01-01
    provides: wagmi v2 + RainbowKit 2.x providers wired in layout.tsx; SSR-safe wallet stack installed
provides:
  - RainbowKit ConnectButton in navbar replacing placeholder button (WALL-02)
  - Chain switcher via chainStatus="icon" in ConnectButton (WALL-03)
  - useDisplayName hook with ENS resolution via chainId:mainnet.id and truncated hex fallback (ENS-01, ENS-02, ENS-03)
  - ENS names on agent cards and agent profile page (ENS-04 partial: bounty board + feed posts surfaces deferred — no wallet_address on Post/Bounty types)
  - truncateAddress utility for server/non-hook contexts
affects:
  - follow-list UI (will reuse useDisplayName when built)
  - any future client component displaying wallet addresses

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useDisplayName hook pattern: always pass chainId: mainnet.id to useEnsName, regardless of connected chain (ENS registry is on Ethereum mainnet)
    - Fall back to static ens_name DB field when wallet_address is absent
    - truncateAddress pure utility for server components

key-files:
  created:
    - src/lib/hooks/use-display-name.ts
  modified:
    - src/components/layout/navbar.tsx
    - src/components/agents/agent-card.tsx
    - src/app/agent/[id]/page.tsx

key-decisions:
  - "Post and bounty cards skip ENS: Post and Bounty types only expose joined display_name fields, no wallet_address — ENS resolution skipped until types are extended"
  - "Agent card prefers live hook resolution over static DB ens_name when wallet_address present"
  - "Agent profile wallet info shows ENS name prominently with truncated hex in parens when ENS resolves"

patterns-established:
  - "ENS pattern: call useEnsName with chainId: mainnet.id, never rely on connected chain for ENS resolution"
  - "Client components needing wallet hooks must have 'use client' directive"

requirements-completed: [WALL-02, WALL-03, ENS-01, ENS-02, ENS-03, ENS-04]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 1 Plan 02: Wallet Connect + ENS Display Summary

**RainbowKit ConnectButton in navbar with ENS name resolution via mainnet hook across agent cards and profile page**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T00:50:18Z
- **Completed:** 2026-03-20T00:52:45Z
- **Tasks:** 2
- **Files modified:** 4 (1 created hook, 3 modified components)

## Accomplishments
- Replaced placeholder Connect button with RainbowKit ConnectButton (showBalance=false, chainStatus=icon, accountStatus=avatar)
- Created useDisplayName hook with chainId: mainnet.id ensuring ENS queries always hit Ethereum mainnet regardless of connected chain
- Applied ENS resolution on agent-card.tsx and agent/[id]/page.tsx with truncated hex fallback
- Build passes with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace placeholder Connect button + create useDisplayName hook** - `3a0a905` (feat)
2. **Task 2: Apply ENS display across agent cards and agent profile** - `27315a0` (feat)

## Files Created/Modified
- `src/components/layout/navbar.tsx` - RainbowKit ConnectButton replaces hardcoded placeholder button
- `src/lib/hooks/use-display-name.ts` - ENS resolution hook using wagmi useEnsName with chainId: mainnet.id; exports truncateAddress utility
- `src/components/agents/agent-card.tsx` - Added 'use client', useDisplayName for live ENS on wallet_address with ens_name static fallback
- `src/app/agent/[id]/page.tsx` - useDisplayName added; ENS name shown prominently in wallet info, truncated hex as secondary

## Decisions Made
- Post and bounty cards do not have wallet_address on their types (only joined display_name fields) — ENS resolution skipped per plan instruction ("if no wallet_address, skip"). Will be addressed when types are extended with wallet addresses.
- Agent card prefers live hook resolution over static DB ens_name when wallet_address is available; falls back to static ens_name for seed agents without wallet addresses.
- Agent profile shows ENS as primary wallet display with truncated hex in parentheses when ENS resolves.

## Deviations from Plan

None - plan executed exactly as written. Post and bounty card ENS was legitimately skipped (no wallet_address on types), which the plan explicitly anticipated with "(if applicable)" notation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wallet connect UI is functional; users can connect, see chain icon, and switch networks via RainbowKit
- ENS resolution hook is ready for reuse in follow list components (Phase 3+) and any future address-displaying components
- Post and Bounty types will need wallet_address joined fields added before ENS can show on feed/bounty cards

---
*Phase: 01-foundation*
*Completed: 2026-03-20*
