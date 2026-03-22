---
phase: 02-filecoin-storage
verified: 2026-03-20T04:15:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 2: Filecoin Storage Verification Report

**Phase Goal:** Agent manifests and execution logs can be uploaded to Filecoin Onchain Cloud and retrieved by CID — the immutable storage layer required by ERC-8004 registration
**Verified:** 2026-03-20T04:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Synapse SDK can be instantiated server-side with a private key (no browser wallet) | VERIFIED | `getSynapse()` in filecoin.ts uses `privateKeyToAccount` + `createWalletClient` with env-var key; `import 'server-only'` guard on line 1 |
| 2 | Upload function accepts a JSON object and returns a PieceCID string | VERIFIED | `uploadToFilecoin(data: object, name: string)` serializes via TextEncoder, calls `context.upload()`, awaits `onPiecesConfirmed` callback, returns `{ pieceCid, retrievalUrl, ... }` |
| 3 | DB schema tracks filecoin CIDs for agent cards and agent logs | VERIFIED | `filecoin_uploads` table in `db.ts` with `agent_id`, `upload_type`, `piece_cid`, `retrieval_url` columns and two indexes |
| 4 | Agent card JSON can be uploaded via POST /api/chain/upload with type=agent_card and a CID is returned | VERIFIED | upload/route.ts validates type against `VALID_TYPES`, calls `uploadToFilecoin`, inserts to DB, returns `{ pieceCid, retrievalUrl, uploadType, agentId, id }` with 201 |
| 5 | Agent execution log JSON can be uploaded via POST /api/chain/upload with type=agent_log and a CID is returned | VERIFIED | Same route handles `agent_log` — `VALID_TYPES` includes it, DB insert uses request-provided `uploadType` variable (not adapter's hardcoded return value) |
| 6 | NFT metadata JSON can be uploaded via POST /api/chain/upload with type=nft_metadata and a CID is returned | VERIFIED | Same route handles `nft_metadata` — same evidence as above |
| 7 | All uploads are tracked in filecoin_uploads table with agent_id, piece_cid, and upload_type | VERIFIED | DB insert on line 66-69 of upload/route.ts: `INSERT INTO filecoin_uploads (id, agent_id, upload_type, piece_cid, retrieval_url, name)` |
| 8 | Uploaded content can be retrieved by CID via GET /api/chain/download/[cid] | VERIFIED | download/[cid]/route.ts calls `downloadFromFilecoin(cid)`, returns content with `Cache-Control: public, max-age=31536000, immutable` header |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/chain/filecoin.ts` | Server-only Filecoin adapter with uploadToFilecoin() and downloadFromFilecoin() | VERIFIED | 90 lines (min_lines: 40). Exports both functions. `import 'server-only'` on line 1. Singleton `_synapse` pattern. Correct `onPiecesConfirmed` callback for upload completion. |
| `src/types/filecoin.ts` | FilecoinUploadResult type and upload type enum | VERIFIED | 18 lines (min_lines: 10). Exports `FilecoinUploadType` union, `FilecoinUploadResult` interface, `FilecoinUploadRecord` interface. |
| `src/lib/db.ts` | filecoin_uploads table for tracking CIDs | VERIFIED | Contains `filecoin_uploads` table (lines 92-102) with `agent_id` FK, `upload_type`, `piece_cid`, `retrieval_url`, `name`, `created_at`. Two indexes present. |
| `src/app/api/chain/upload/route.ts` | POST endpoint for uploading agent_card, agent_log, or nft_metadata to Filecoin | VERIFIED | Exports `POST`. Validates all three types. Calls `uploadToFilecoin`. Inserts to DB. Returns 201 on success, 400/502/500 on errors. |
| `src/app/api/chain/download/[cid]/route.ts` | GET endpoint to retrieve content from Filecoin by PieceCID | VERIFIED | Exports `GET`. Calls `downloadFromFilecoin(cid)`. Next.js 16 async params pattern. Immutable cache header. 404 on any error. |
| `src/app/api/agents/[id]/filecoin/route.ts` | GET endpoint to list all Filecoin uploads for an agent | VERIFIED | Exports `GET`. Queries `filecoin_uploads WHERE agent_id = ?`. Optional `?type=` filter with validation. Returns empty array (not 404) for agents with no uploads. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/chain/filecoin.ts` | `@filoz/synapse-sdk` | `new Synapse({ client, source: null })` | WIRED | Line 26: `_synapse = new Synapse({ client, source: null })`. Package confirmed in package.json as `"@filoz/synapse-sdk": "^0.40.0"` |
| `src/lib/chain/filecoin.ts` | `viem` | `createWalletClient` with `privateKeyToAccount` | WIRED | Lines 3-4: imports `createWalletClient`, `http`, `type Hex` from viem; `privateKeyToAccount` from viem/accounts. Used in `getSynapse()` line 23. |
| `src/app/api/chain/upload/route.ts` | `src/lib/chain/filecoin.ts` | imports `uploadToFilecoin` | WIRED | Line 1: `import { uploadToFilecoin } from '@/lib/chain/filecoin'`. Called on line 62. |
| `src/app/api/chain/upload/route.ts` | `src/lib/db.ts` | inserts into `filecoin_uploads` table | WIRED | Line 2: `import { getDb }`. DB insert on lines 66-69 references `filecoin_uploads` table directly. |
| `src/app/api/chain/download/[cid]/route.ts` | `src/lib/chain/filecoin.ts` | imports `downloadFromFilecoin` | WIRED | Line 1: `import { downloadFromFilecoin } from '@/lib/chain/filecoin'`. Called on line 10. |
| `src/app/api/agents/[id]/filecoin/route.ts` | `src/lib/db.ts` | queries `filecoin_uploads` by `agent_id` | WIRED | Line 2: `import { getDb }`. Queries `filecoin_uploads WHERE agent_id = ?` on lines 27-36. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FIL-01 | 02-02-PLAN.md | Agent card JSON (for ERC-8004) uploaded to Filecoin Onchain Cloud | SATISFIED | POST /api/chain/upload with `type=agent_card` — validated, uploads via Synapse SDK, persisted with `upload_type='agent_card'` |
| FIL-02 | 02-02-PLAN.md | Agent execution logs (agent_log.json) stored on Filecoin | SATISFIED | POST /api/chain/upload with `type=agent_log` — same route, `agent_log` in VALID_TYPES, correctly stored in DB |
| FIL-03 | 02-02-PLAN.md | NFT metadata stored on Filecoin with verifiable PieceCID | SATISFIED | POST /api/chain/upload with `type=nft_metadata` — `nft_metadata` in VALID_TYPES, returns `pieceCid` and `retrievalUrl` |
| FIL-04 | 02-01-PLAN.md | Storage operations use @filoz/synapse-sdk with headless session keys | SATISFIED | `filecoin.ts` uses `privateKeyToAccount(process.env.FILECOIN_PRIVATE_KEY)` + `createWalletClient` — no browser wallet, SDK at `^0.40.0` in package.json |

No orphaned requirements. All four FIL requirements are accounted for across the two plans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/chain/filecoin.ts` | 75 | `uploadType: 'agent_card'` hardcoded in adapter return value | INFO | The `FilecoinUploadResult` interface requires an `uploadType` field; the adapter always returns `'agent_card'` as a placeholder. The upload API route correctly ignores `result.uploadType` and uses the validated `uploadType` from the request body when inserting into DB and in the JSON response. This is documented in SUMMARY key-decisions. No functional impact — callers must not rely on `result.uploadType` being accurate. |

No blockers or warnings found.

---

### Human Verification Required

#### 1. Live Upload to Filecoin Calibration Testnet

**Test:** With a funded wallet (`FILECOIN_PRIVATE_KEY` set to a key holding tFIL and tUSDFC on calibration), POST to `/api/chain/upload` with `{ type: "agent_card", agentId: "test-123", data: { name: "Test Agent" } }`.
**Expected:** Response status 201 with a `pieceCid` string (e.g. `baga...`), `retrievalUrl` pointing to `https://cdn.filecoin.cloud/<cid>`, and a row in `filecoin_uploads` table. After confirmation delay, GET `/api/chain/download/<cid>` returns the original JSON.
**Why human:** The Synapse SDK upload flow (storage contract payment, PDP proof, `onPiecesConfirmed` callback) requires a live funded wallet and real network round-trips. Cannot be verified by static code analysis.

#### 2. Upload Confirmation Timing

**Test:** Monitor the upload duration from POST request to 201 response when live.
**Expected:** May take 30 seconds to several minutes. Verify the server does not time out and returns a valid CID rather than an error.
**Why human:** Timeout behavior and real-world confirmation latency require a live network test.

---

### Observations

**uploadType hardcoding in adapter (INFO):** `uploadToFilecoin()` in `filecoin.ts` returns `uploadType: 'agent_card'` unconditionally (line 75) because the function signature does not accept an `uploadType` parameter. This is intentional per the SUMMARY key-decisions note: "uploadToFilecoin returns uploadType defaulted to agent_card; callers should override when persisting FilecoinUploadRecord to DB." The upload route correctly uses its own `uploadType` variable (sourced from validated request input) for both DB persistence and API response — `result.uploadType` is never read by the route. Future callers of `uploadToFilecoin` must be aware of this — the returned `uploadType` field should not be trusted.

**Server-only guard is correctly placed:** `import 'server-only'` on line 1 of `filecoin.ts` prevents accidental client-side bundling. Confirmed: no component or `.tsx` files import from `filecoin.ts` — only the two API routes (`upload/route.ts` and `download/[cid]/route.ts`) do so.

**DB insert uses correct uploadType:** The upload route uses `uploadType` (from the validated request, line 41) — not `result.uploadType` (from the adapter's hardcoded return) — when calling `db.prepare(...).run(id, agentId, uploadType, ...)` on line 69. This is correct.

---

## Summary

All 8 observable truths verified. All 6 artifacts exist, are substantive (no stubs or placeholders), and are correctly wired. All 4 requirement IDs (FIL-01 through FIL-04) are satisfied with direct implementation evidence. No orphaned requirements.

The phase goal is achieved: agent manifests and execution logs can be uploaded to Filecoin Onchain Cloud via `POST /api/chain/upload` and retrieved by CID via `GET /api/chain/download/[cid]`. The immutable storage layer is in place for ERC-8004 registration to consume in Phase 3.

One human verification item remains: live end-to-end upload test requiring a funded wallet on Filecoin calibration testnet.

---

_Verified: 2026-03-20T04:15:00Z_
_Verifier: Claude (gsd-verifier)_
