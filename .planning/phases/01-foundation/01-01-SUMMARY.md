---
phase: 01-foundation
plan: 01
subsystem: ui
tags: [wagmi, rainbowkit, viem, walletconnect, ssr, react-query]

# Dependency graph
requires: []
provides:
  - wagmi v2 config with Base + baseSepolia + mainnet chains, SSR cookieStorage
  - Client-side Providers component (WagmiProvider + QueryClientProvider + RainbowKitProvider)
  - Server-side SSR cookie hydration wired to layout.tsx
  - Turbopack-compatible wallet provider tree (no polyfill config needed)
affects: [02-wallet-ui, 03-ui-polish, all-on-chain-phases]

# Tech tracking
tech-stack:
  added:
    - "@rainbow-me/rainbowkit@2.2.10"
    - "wagmi@2.19.5 (pinned to v2 — incompatible with v3)"
    - "viem@2.47.5"
    - "@tanstack/react-query@5.91.2"
  patterns:
    - "SSR wallet hydration: server reads cookies, passes to Providers, cookieToInitialState restores state"
    - "Client provider isolation: 'use client' wrapper prevents server/client boundary pollution"
    - "RainbowKit styles imported in client component (not globals.css) to avoid Tailwind 4 CSS conflicts"

key-files:
  created:
    - src/lib/wagmi.ts
    - src/components/layout/providers.tsx
  modified:
    - src/app/layout.tsx
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Pin wagmi to v2.x — wagmi v3 is incompatible with RainbowKit 2.2.10 (peer dep requires wagmi@^2.9.0)"
  - "Import RainbowKit styles.css in providers.tsx (client component), NOT in globals.css — prevents Tailwind 4 conflict"
  - "No webpack or Turbopack polyfill config needed — viem/wagmi/RainbowKit are ESM-native, Turbopack handles them natively"
  - "layout.tsx made async with await cookies() for Next.js 16 compatibility (synchronous cookies() throws)"

patterns-established:
  - "Provider pattern: server layout reads cookies, passes to client Providers wrapper"
  - "useState(() => new QueryClient()) pattern for stable QueryClient across re-renders"

requirements-completed: [WALL-01, WALL-04, WALL-05]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 1 Plan 01: Wallet Stack Installation Summary

**RainbowKit 2.2.10 + wagmi v2 + viem v2 provider tree with SSR cookie hydration wired into Next.js 16 async layout**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-20T00:43:27Z
- **Completed:** 2026-03-20T00:47:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed full wallet stack (RainbowKit, wagmi v2, viem, react-query) with correct version pinning
- Created wagmi config with Base + baseSepolia + mainnet chains, SSR mode, and cookieStorage
- Created client-side Providers component wrapping the entire app in WagmiProvider + QueryClientProvider + RainbowKitProvider
- Updated layout.tsx to be async and read cookies server-side for SSR wallet state hydration
- Build passes cleanly with Turbopack — zero polyfill errors, no webpack config needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Install wallet packages and create wagmi config** - `784be01` (feat)
2. **Task 2: Create Providers component and update layout.tsx for SSR** - `cfc047b` (feat)

**Plan metadata:** (created below)

## Files Created/Modified
- `src/lib/wagmi.ts` - wagmiConfig with getDefaultConfig, Base + baseSepolia + mainnet chains, ssr: true, cookieStorage
- `src/components/layout/providers.tsx` - Client Providers wrapper with 'use client', cookieToInitialState for SSR hydration
- `src/app/layout.tsx` - Now async, reads cookies via await cookies(), wraps children in Providers
- `package.json` / `pnpm-lock.yaml` - Wallet packages added

## Decisions Made
- Pinned wagmi to v2.19.5 — the default pnpm install resolved wagmi v3.5.0, which has an unmet peer dependency with RainbowKit 2.2.10 (requires wagmi@^2.9.0). Explicitly reinstalled with `wagmi@^2.9.0`.
- RainbowKit styles imported in `providers.tsx` (not `globals.css`) to avoid Tailwind 4 CSS conflict.
- No `turbopack.resolveAlias` or webpack polyfill config was needed — Turbopack handled ESM-native wagmi/viem/RainbowKit without any additional configuration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Downgraded wagmi from v3 to v2**
- **Found during:** Task 1 (package installation)
- **Issue:** `pnpm add wagmi` resolved to wagmi v3.5.0, which is incompatible with RainbowKit 2.2.10 (unmet peer dep: wagmi@^2.9.0). STATE.md explicitly states to pin wagmi to v2.
- **Fix:** Re-ran `pnpm add wagmi@^2.9.0`, which installed v2.19.5 and resolved the peer dependency
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** `pnpm list wagmi` shows 2.19.5, no peer dependency errors for rainbowkit
- **Committed in:** 784be01 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug/version mismatch)
**Impact on plan:** Essential fix — wagmi v3 would have caused runtime incompatibility with RainbowKit. No scope creep.

## Issues Encountered
- pnpm's default resolution for `wagmi` selected v3.5.0 rather than v2.x — required explicit version pinning to `wagmi@^2.9.0`. Resolved immediately by re-installing with version constraint.

## User Setup Required

**External services require manual configuration before wallet connection works:**

1. Go to https://cloud.walletconnect.com — create a free project, copy the Project ID
2. Update `.env.local` — replace `your_project_id_here` with your actual Project ID:
   ```
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_actual_project_id
   ```
3. Run `pnpm dev` and test wallet connection

## Next Phase Readiness
- Wallet provider tree is ready — Plan 02 (Wallet UI) can add ConnectButton to Navbar and wallet hooks throughout the app
- All on-chain phases depend on this wagmiConfig — it's the source of truth for chain configuration (Base, baseSepolia, mainnet for ENS)
- SSR hydration is wired — wallet state will persist correctly across page refreshes once a real WalletConnect project ID is provided

---
*Phase: 01-foundation*
*Completed: 2026-03-20*
