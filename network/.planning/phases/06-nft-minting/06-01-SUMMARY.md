---
phase: 06-nft-minting
plan: "01"
subsystem: api
tags: [rare-protocol, erc721, nft, base-sepolia, filecoin, superrare]

# Dependency graph
requires:
  - phase: 02-filecoin-storage
    provides: uploadToFilecoin adapter for metadata storage
  - phase: 03-erc-8004-identity
    provides: server-only chain module pattern with viem
provides:
  - Rare Protocol chain module (deployCollection, mintPostNFT)
  - POST /api/chain/deploy-collection endpoint
  - POST /api/chain/mint-nft endpoint
affects: [06-02-PLAN, 08-integration]

# Tech tracking
tech-stack:
  added: ["@rareprotocol/rare-cli@0.3.0"]
  patterns: ["Rare Protocol createRareClient with viem clients", "object-param SDK API (not positional args)"]

key-files:
  created:
    - src/lib/chain/nft.ts
    - src/app/api/chain/deploy-collection/route.ts
    - src/app/api/chain/mint-nft/route.ts
  modified: []

key-decisions:
  - "SDK deploy.erc721 and mint.mintTo use object params (not positional args as research suggested)"
  - "Type assertion (as any) needed for viem client compatibility between project viem and SDK viem"
  - "Mint route auto-deploys collection if agent lacks one (no separate deploy step required)"

patterns-established:
  - "Rare Protocol client: createRareClient with publicClient/walletClient as any for cross-version viem compat"
  - "NFT mint flow: build metadata -> upload to Filecoin -> mint with retrievalUrl as tokenURI"

requirements-completed: [NFT-01, NFT-02]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 6 Plan 1: NFT Minting Foundation Summary

**Rare Protocol ERC-721 chain module with deploy-collection and mint-nft API routes, Filecoin metadata storage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T04:22:46Z
- **Completed:** 2026-03-21T04:25:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed @rareprotocol/rare-cli@0.3.0 and created server-only chain module with deployCollection and mintPostNFT
- Built idempotent deploy-collection route that creates one ERC-721 collection per agent on Base Sepolia
- Built idempotent mint-nft route that uploads ERC-721 metadata to Filecoin, then mints NFT via Rare Protocol

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Rare Protocol SDK and create NFT chain module** - `4e27e02` (feat)
2. **Task 2: Create deploy-collection and mint-nft API routes** - `1a1a429` (feat)

## Files Created/Modified
- `src/lib/chain/nft.ts` - Server-only Rare Protocol chain module with deployCollection and mintPostNFT exports
- `src/app/api/chain/deploy-collection/route.ts` - POST endpoint to deploy ERC-721 collection for an agent (idempotent)
- `src/app/api/chain/mint-nft/route.ts` - POST endpoint to mint post as NFT with Filecoin metadata (idempotent, auto-deploys collection)
- `package.json` - Added @rareprotocol/rare-cli dependency

## Decisions Made
- SDK deploy.erc721() and mint.mintTo() use object params `{ name, symbol }` and `{ contract, to, tokenUri }` -- research assumed positional args but actual SDK uses named params
- Used `as any` type assertion for viem clients passed to createRareClient -- project viem and SDK viem are structurally compatible but TypeScript sees them as nominally different types due to version differences
- Mint route auto-deploys collection if agent has no nft_collection_address -- simplifies client usage, no separate deploy step needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SDK method signatures differ from research**
- **Found during:** Task 1 (chain module creation)
- **Issue:** Research said `rare.deploy.erc721(name, symbol)` but actual SDK uses `rare.deploy.erc721({ name, symbol })`
- **Fix:** Used actual object-param API as documented in SDK type definitions
- **Files modified:** src/lib/chain/nft.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 4e27e02

**2. [Rule 3 - Blocking] Viem version type mismatch**
- **Found during:** Task 1 (chain module creation)
- **Issue:** Project viem and SDK viem produce nominally different PublicClient/WalletClient types causing TS2719
- **Fix:** Used `as any` type assertion for clients passed to createRareClient
- **Files modified:** src/lib/chain/nft.ts
- **Verification:** npx tsc --noEmit passes, pnpm build succeeds
- **Committed in:** 4e27e02

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required. Uses existing AGENT_PRIVATE_KEY env var.

## Next Phase Readiness
- Chain module and API routes ready for UI integration in plan 06-02
- NFT badge on post cards and portfolio tab can now query posts with nft_contract set
- Both routes are idempotent and safe to call multiple times

---
*Phase: 06-nft-minting*
*Completed: 2026-03-21*
