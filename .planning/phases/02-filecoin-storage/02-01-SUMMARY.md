---
phase: 02-filecoin-storage
plan: "01"
subsystem: storage
tags: [filecoin, synapse-sdk, viem, ethers, sqlite, server-only]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Next.js 16 app router, better-sqlite3 DB, viem 2.x (already installed)
provides:
  - Server-only Filecoin adapter (uploadToFilecoin / downloadFromFilecoin)
  - FilecoinUploadResult and FilecoinUploadRecord types
  - filecoin_uploads table in SQLite schema with agent_id FK and indexes
  - @filoz/synapse-sdk 0.40.0 and ethers 6.x installed
affects:
  - 02-02-filecoin-upload-api (consumes uploadToFilecoin)
  - 03-erc8004 (consumes pieceCid from upload results as agentURI)
  - 05-nft-minting (uses nft_metadata upload type)

# Tech tracking
tech-stack:
  added:
    - "@filoz/synapse-sdk 0.40.0 — Filecoin Onchain Cloud SDK with PDP storage proofs"
    - "ethers 6.16.0 — required peer dependency of synapse-sdk"
  patterns:
    - "server-only guard at top of filecoin.ts prevents client-side bundling"
    - "Singleton Synapse instance pattern (module-level _synapse variable, same as _db in db.ts)"
    - "onPiecesConfirmed callback used as upload-done signal (not onStored — data not guaranteed retrievable until PDP proof confirmed)"

key-files:
  created:
    - src/lib/chain/filecoin.ts
    - src/types/filecoin.ts
  modified:
    - src/lib/db.ts
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Import getChain from @filoz/synapse-sdk (not @filoz/synapse-core/chains) — synapse-core is not hoisted to top-level node_modules in pnpm; synapse-sdk re-exports getChain from its index"
  - "Pass source: null to SynapseFromClientOptions — required field in SDK v0.40.0 (referral tracking, null disables it)"
  - "Use synapse.storage.download({ pieceCid }) not synapse.download() — download lives on StorageManager, not Synapse directly"
  - "uploadToFilecoin returns uploadType defaulted to agent_card; callers should override when persisting FilecoinUploadRecord to DB"
  - "Use onPiecesConfirmed callback for upload completion — onStored fires earlier but retrieval is not guaranteed until PDP proof is on-chain"

patterns-established:
  - "Pattern: All Filecoin operations route through src/lib/chain/filecoin.ts — never import synapse-sdk elsewhere"
  - "Pattern: filecoin.ts is server-only; only accessible via Next.js API routes (never client components)"

requirements-completed: [FIL-04]

# Metrics
duration: 6min
completed: 2026-03-20
---

# Phase 2 Plan 01: Filecoin Adapter Foundation Summary

**Server-only Synapse SDK adapter with uploadToFilecoin/downloadFromFilecoin, FilecoinUploadResult types, and filecoin_uploads SQLite table for CID tracking**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-20T03:28:46Z
- **Completed:** 2026-03-20T03:34:35Z
- **Tasks:** 2
- **Files modified:** 5 (created: 3, modified: 2)

## Accomplishments
- Installed @filoz/synapse-sdk 0.40.0 and ethers 6.16.0 with correct peer dep
- Created server-only Filecoin adapter with singleton Synapse instance pattern
- Defined FilecoinUploadType, FilecoinUploadResult, and FilecoinUploadRecord types
- Added filecoin_uploads table to SQLite schema with agent_id FK and two indexes
- Build passes cleanly — filecoin.ts never bundled client-side

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Synapse SDK and create Filecoin types** - `c4f6b3d` (feat)
2. **Task 2: Create Filecoin adapter and add DB schema** - `7cbb5f1` (feat)

## Files Created/Modified
- `src/lib/chain/filecoin.ts` - Server-only Synapse adapter with uploadToFilecoin() and downloadFromFilecoin()
- `src/types/filecoin.ts` - FilecoinUploadType union, FilecoinUploadResult and FilecoinUploadRecord interfaces
- `src/lib/db.ts` - Added filecoin_uploads table with agent_id FK and indexes
- `package.json` - Added @filoz/synapse-sdk and ethers dependencies
- `.env.local` - Added FILECOIN_PRIVATE_KEY and FILECOIN_NETWORK placeholders (gitignored)

## Decisions Made
- **Import path for getChain:** The plan specified `import { getChain } from '@filoz/synapse-core/chains'` but synapse-core is not hoisted to top-level node_modules in pnpm — it is a private dep of synapse-sdk. Using `@filoz/synapse-sdk` (which re-exports `getChain`) resolves correctly without needing synapse-core directly.
- **source: null required:** SDK v0.40.0 `SynapseFromClientOptions` requires `source: string | null`. Set to `null` (disables referral tracking).
- **download API location:** `synapse.download()` does not exist — method is on `synapse.storage.download({ pieceCid })` per StorageManager type definitions.
- **onPiecesConfirmed as done signal:** Research recommended this over `onStored`. Implemented as a wrapped Promise to correctly await the async callback pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected three API mismatches from research/plan specifications**
- **Found during:** Task 2 (TypeScript compilation — `npx tsc --noEmit` revealed all three)
- **Issue 1:** `@filoz/synapse-core/chains` not resolvable in pnpm — synapse-core not hoisted to top-level node_modules. Fix: import `getChain` from `@filoz/synapse-sdk` (re-exports it).
- **Issue 2:** `SynapseFromClientOptions` requires `source: string | null` field — missing in initial implementation. Fix: added `source: null`.
- **Issue 3:** `synapse.download(pieceCid)` does not exist on `Synapse` class — method is `synapse.storage.download({ pieceCid })`. Fix: updated download call.
- **Files modified:** src/lib/chain/filecoin.ts
- **Verification:** `npx tsc --noEmit` passes; `pnpm build` passes
- **Committed in:** 7cbb5f1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — three related type/API bugs caught by tsc)
**Impact on plan:** All fixes necessary for compilation and correct API usage. No scope creep.

## Issues Encountered
- `@filoz/synapse-core` is not a top-level package despite being re-exported by `@filoz/synapse-sdk`. The research document referenced direct imports from `@filoz/synapse-core/chains`, but pnpm does not hoist transitive private deps. Resolved by importing from the main synapse-sdk entry point which re-exports `getChain` and all chain utilities.

## User Setup Required

**External services require manual configuration before uploads will work:**

1. **Generate a new Ethereum-compatible private key** (e.g. `cast wallet new` from Foundry)
2. **Fund with tFIL (gas):** https://faucet.calibration.filecoin.io/
3. **Fund with tUSDFC (storage payment):** https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc
4. **Update `.env.local`:** Replace `0x_REPLACE_WITH_FUNDED_WALLET_KEY` with your funded wallet's private key

Until the wallet is funded, `uploadToFilecoin()` will fail with a payment contract error.

## Next Phase Readiness
- Phase 2 Plan 02 (upload API route) can now implement `POST /api/chain/upload` by importing `uploadToFilecoin` from `@/lib/chain/filecoin`
- Phase 3 (ERC-8004) can use returned `pieceCid` as agentURI via `https://cdn.filecoin.cloud/<pieceCid>`
- Wallet funding is a prerequisite for any actual upload — should be completed before testing Plan 02

---
*Phase: 02-filecoin-storage*
*Completed: 2026-03-20*
