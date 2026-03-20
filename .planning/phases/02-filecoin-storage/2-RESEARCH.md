# Phase 2: Filecoin Storage - Research

**Researched:** 2026-03-20
**Domain:** Filecoin Onchain Cloud / @filoz/synapse-sdk — decentralized storage for agent manifests, execution logs, and NFT metadata
**Confidence:** MEDIUM (SDK v0.40.0, pre-1.0, active development; mainnet confirmed live; API patterns verified from official GitHub source code)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIL-01 | Agent card JSON (for ERC-8004) uploaded to Filecoin Onchain Cloud | Synapse SDK upload API + server-side adapter pattern; returns PieceCID used as agentURI |
| FIL-02 | Agent execution logs (agent_log.json) stored on Filecoin | Same upload path as FIL-01; structured JSON serialized to Buffer/ReadableStream before upload |
| FIL-03 | NFT metadata stored on Filecoin with verifiable PieceCID | Same Synapse upload; PieceCID is the verifiable commitment used in NFT metadata URI |
| FIL-04 | Storage operations use @filoz/synapse-sdk with headless session keys | Synapse.create() with privateKey + account — no browser wallet required; server-side hot wallet |
</phase_requirements>

---

## Summary

Filecoin Onchain Cloud (FOC) launched on mainnet on January 31, 2026 (confirmed). The `@filoz/synapse-sdk` v0.40.0 (released March 17, 2026) is the official SDK for FOC storage operations. It is pre-1.0 and breaking changes have occurred before (v0.24.0 restructured the storage API), so docs and GitHub source must be consulted — not pre-v0.24 tutorials.

The SDK is built on top of viem and requires `ethers` v6 as a peer dependency. It supports three environments: **mainnet** (Filecoin chain ID 314), **calibration testnet** (chain ID 314159), and devnet. For a hackathon that needs to show real storage proofs, calibration testnet with a free USDFC faucet is the safe path for development; mainnet is available but requires actual USDFC tokens.

The core upload pattern is: create a viem wallet client using a server-side private key → instantiate `Synapse` → create a storage context → upload `ReadableStream` → receive `PieceCID` (also called CommP). The PieceCID is the verifiable commitment used as the identifier in all downstream operations (ERC-8004 agentURI, NFT metadata URI). Important: PieceCID is NOT an IPFS CID — they are incompatible formats. If IPFS gateway URLs are needed (for ERC-8004 agentURI pointing), use `filecoin.cloud` gateway URLs based on the PieceCID, not `ipfs.io` gateway URLs.

**Primary recommendation:** Implement `src/lib/chain/filecoin.ts` as a server-only adapter using `Synapse.create()` with a `FILECOIN_PRIVATE_KEY` env var. Use calibration testnet (chain ID 314159) for development, with a flag to switch to mainnet (chain ID 314) for demo. Pre-fund the deployment wallet with tUSDFC from the ChainSafe faucet before running the phase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@filoz/synapse-sdk` | 0.40.0 | Upload/download files to Filecoin Onchain Cloud, returns PieceCID | Official FilOzone SDK; only supported path for FOC; covers storage + payments in one SDK |
| `ethers` | ^6.x | Peer dependency of synapse-sdk | Required explicitly; SDK will fail silently with wrong version |
| `viem` | ^2.x (already installed) | Create wallet client for Synapse initialization | Already in project stack; synapse uses viem-compatible clients |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@filoz/synapse-core` | (included transitively) | Chain definitions, PieceCID utilities, payment functions | Imported transitively from synapse-sdk; only import directly if you need `getChain()` or `PieceCID` types |
| `@filoz/synapse-react` | (optional) | React hooks for upload progress | Only needed if building a browser upload UI; not needed for server-side agent uploads |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@filoz/synapse-sdk` | Lighthouse SDK | Lighthouse is IPFS-only (not FOC); doesn't produce on-chain verifiable PieceCID; incompatible with FOC requirements |
| `@filoz/synapse-sdk` | Pinata SDK | Pinata is pure IPFS pinning; no Filecoin deal proofs; acceptable for metadata-only but doesn't satisfy FIL-01/02/03 verifiability requirement |
| Filecoin calibration testnet | Filecoin mainnet | Mainnet requires funded USDFC; calibration has free faucet — use calibration for dev, mainnet for final demo |

**Installation:**
```bash
pnpm add @filoz/synapse-sdk ethers
```

Note: `viem` is already installed. `ethers` must be added explicitly — it is a peer dep, not auto-installed.

---

## Architecture Patterns

### Recommended Project Structure

Following the architecture established in ARCHITECTURE.md research:

```
src/
├── lib/
│   └── chain/
│       └── filecoin.ts         # NEW: Synapse SDK wrapper (server-only)
├── app/
│   └── api/
│       └── chain/
│           └── upload/
│               └── route.ts    # NEW: POST /api/chain/upload
└── types/
    └── filecoin.ts             # NEW: FilecoinUploadResult type
```

The filecoin adapter lives in `src/lib/chain/filecoin.ts` — server-only, never imported by client components. All uploads go through `POST /api/chain/upload` which accepts `{ type: 'agent_card' | 'agent_log' | 'nft_metadata', agentId, data }`.

### Pattern 1: Headless Synapse Initialization (Server-Side)

**What:** Create a Synapse instance using a server-side private key. No browser wallet. This is the "headless" pattern required by FIL-04.

**When to use:** All three upload use cases (FIL-01, FIL-02, FIL-03) — agent cards, logs, NFT metadata.

**Example:**
```typescript
// Source: github.com/FilOzone/synapse-sdk examples/cli/src/client.ts + synapse.ts
import { Synapse } from '@filoz/synapse-sdk'
import { getChain } from '@filoz/synapse-core/chains'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const FILECOIN_CHAIN_ID = process.env.FILECOIN_NETWORK === 'mainnet' ? 314 : 314159

export async function getSynapse(): Promise<Synapse> {
  const privateKey = process.env.FILECOIN_PRIVATE_KEY as `0x${string}`
  const chain = getChain(FILECOIN_CHAIN_ID)
  const account = privateKeyToAccount(privateKey)
  const client = createWalletClient({ account, chain, transport: http() })

  return new Synapse({ client })
}
```

### Pattern 2: Upload JSON Object as File

**What:** Serialize a JSON object (agent.json, agent_log.json, or NFT metadata) to a `ReadableStream` of bytes and upload via `storage.createContext()` + `context.upload()`.

**When to use:** FIL-01 (agent card), FIL-02 (execution logs), FIL-03 (NFT metadata).

**Example:**
```typescript
// Source: github.com/FilOzone/synapse-sdk examples/cli/src/commands/upload.ts (adapted for JSON)
import type { PieceCID } from '@filoz/synapse-core/piece'

export async function uploadJSON(
  synapse: Synapse,
  data: object,
  name: string
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    }
  })

  let pieceCid: PieceCID | undefined

  const context = await synapse.storage.createContext({
    withCDN: true,
    callbacks: {
      onUploadComplete: (cid) => { pieceCid = cid }
    }
  })

  await context.upload(stream, {
    pieceMetadata: { name },
    onStored(providerId, cid) { pieceCid = cid }
  })

  if (!pieceCid) throw new Error('Upload completed but no PieceCID returned')
  return pieceCid.toString()
}
```

### Pattern 3: Download / Retrieve by PieceCID

**What:** Retrieve content previously uploaded using its PieceCID string.

**When to use:** Verifying upload succeeded; serving agent manifests to ERC-8004 consumers.

**Example:**
```typescript
// Source: FIL-Builders/fs-upload-dapp + synapse-sdk docs
export async function downloadByCID(synapse: Synapse, pieceCid: string): Promise<object> {
  const data = await synapse.download(pieceCid)
  const text = new TextDecoder().decode(data)
  return JSON.parse(text)
}
```

### Pattern 4: Pre-fund Check (Deposit USDFC Before First Upload)

**What:** The SDK requires a funded payments account before uploading. On calibration, use the faucet once and store the private key. On mainnet, fund manually before demo.

**When to use:** Initial setup — run once as a setup script, not on every upload.

```typescript
// Source: docs.filecoin.cloud/developer-guides/synapse/ (deposit API)
// Run once before uploads begin
export async function ensureFunded(synapse: Synapse, amountUSDFC: bigint) {
  const balance = await synapse.payments.balance()
  if (balance < amountUSDFC) {
    await synapse.payments.deposit(amountUSDFC)
  }
}
```

### Anti-Patterns to Avoid

- **Using IPFS gateway URLs for PieceCIDs:** PieceCID (CommP) is NOT an IPFS CID. `ipfs.io/ipfs/<PieceCID>` will 404. Use `https://cdn.filecoin.cloud/<PieceCID>` or the SDK's download method.
- **Importing filecoin.ts from client components:** The adapter uses Node.js crypto internals via viem/ethers. Next.js will bundle it client-side and fail. Mark it server-only or only call via API route.
- **Uploading every time the app starts:** Agent cards and logs should be uploaded once and their PieceCID stored in SQLite. Check DB before uploading.
- **Hardcoding chain ID 314159:** Use an env var `FILECOIN_NETWORK=calibration|mainnet` to switch without code changes.
- **Calling `getChain()` with the wrong ID:** `getChain` from `@filoz/synapse-core/chains` expects Filecoin chain IDs (314 / 314159), not EVM chains like Base (8453). These are separate networks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CommP / PieceCID calculation | Custom Merkle DAG commitment math | `@filoz/synapse-sdk` upload API | CommP is a cryptographic Merkle proof over 32-byte aligned padded pieces; implementing correctly requires FR32 padding, Merkle-DAG construction. The SDK does this. |
| USDFC payment rail setup | Custom ERC-20 approval + payment contract calls | `synapse.payments.deposit()` + `synapse.payments.approveService()` | FilecoinPay v1 contract has specific approval semantics (rate allowance + lockup allowance); one missed step and uploads silently fail |
| Storage provider discovery | Manual registry queries | `synapse.storage.createContext()` | ServiceProviderRegistry contract selection is handled by the SDK; wrong provider selection causes retrieval failures |
| Upload progress tracking | Custom byte counting | SDK `onStored` / `onPiecesAdded` callbacks | Upload is streamed in pieces; the SDK provides callbacks at each confirmation stage |

**Key insight:** FOC storage is not "upload a file to S3" — it involves proof-of-data-possession commitments, on-chain payment rails, and storage provider selection. None of these should be hand-rolled.

---

## Common Pitfalls

### Pitfall 1: SDK Is Pre-1.0 — Don't Follow Old Tutorials
**What goes wrong:** Tutorials and blog posts written before v0.24.0 use a completely different API (context-based API was introduced at v0.24.0). Using old patterns fails silently or throws confusing type errors.
**Why it happens:** Rapid API evolution; v0.40.0 is current but API surface changed significantly at v0.24.0.
**How to avoid:** Only reference the official GitHub examples at `github.com/FilOzone/synapse-sdk` and `docs.filecoin.cloud`. Ignore any tutorial dated before November 2025.
**Warning signs:** Import errors for `SynapseClient`, `createStorageSession`, or any pre-v0.24 class names.

### Pitfall 2: USDFC Deposit Required Before First Upload
**What goes wrong:** Upload call hangs or returns a payment error because the payments account has no USDFC balance.
**Why it happens:** FOC is a pay-per-epoch storage model. No pre-funded balance = no storage.
**How to avoid:**
- Calibration: fund with ChainSafe faucet at `forest-explorer.chainsafe.dev/faucet/calibnet_usdfc` (dispenses tUSDFC for free).
- Mainnet: manually acquire USDFC tokens and deposit before first upload.
- Build a `checkFunds()` health check that runs at startup.
**Warning signs:** Upload hangs indefinitely; payment contract reverts with insufficient balance error.

### Pitfall 3: PieceCID Is Not Retrievable Immediately
**What goes wrong:** Upload returns a PieceCID, code immediately calls `synapse.download(pieceCid)`, gets a not-found error. The test seems broken but the upload succeeded.
**Why it happens:** The PieceCID is committed on-chain but propagation to retrieval providers takes time (seconds to minutes). The `onPiecesConfirmed` callback fires when data is verifiably stored and retrievable.
**How to avoid:** Wait for `onPiecesConfirmed` callback before storing the PieceCID in SQLite. Don't use `onStored` as the "done" signal for retrieval purposes.
**Warning signs:** "File not found" immediately after upload; works after waiting 30 seconds.

### Pitfall 4: ethers v6 Peer Dep Missing
**What goes wrong:** `@filoz/synapse-sdk` fails at import time with a missing module error referencing ethers internals.
**Why it happens:** `ethers` v6 is a declared peer dependency — npm/pnpm won't install it automatically. The package.json shows it must be explicitly added.
**How to avoid:** Always run `pnpm add @filoz/synapse-sdk ethers` together. Verify `ethers` is in `package.json` dependencies, not just devDependencies.
**Warning signs:** `Cannot find module 'ethers'` or `Cannot find module '@ethersproject/...'` at runtime.

### Pitfall 5: Server-Side Only — Node.js Crypto
**What goes wrong:** Importing `filecoin.ts` (or `@filoz/synapse-sdk`) in a client component causes a Webpack build error about missing `crypto` or `fs` modules.
**Why it happens:** The SDK uses Node.js native `crypto` for key operations. Webpack 5 in Next.js doesn't polyfill these for client bundles.
**How to avoid:** Add `'server-only'` import at the top of `src/lib/chain/filecoin.ts`. Only call upload logic through `/api/chain/upload` API route. Never import the adapter in a `'use client'` component.
**Warning signs:** `Module not found: Can't resolve 'crypto'` or `'fs'` during `next build`.

### Pitfall 6: Filecoin Private Key Wallet Has No FIL for Gas
**What goes wrong:** USDFC deposit transaction (or any on-chain transaction) fails because the wallet has no FIL for gas fees.
**Why it happens:** Filecoin chain (like all EVM chains) requires the native token (FIL / tFIL) for gas, even if you're paying storage costs in USDFC.
**How to avoid:**
- Calibration: get tFIL from `faucet.calibration.filecoin.io` in addition to tUSDFC.
- Mainnet: ensure the hot wallet has a small FIL balance for gas.
**Warning signs:** Transaction reverts with "insufficient gas" or "account has no balance"; distinct from USDFC balance issues.

---

## Code Examples

Verified patterns from official sources:

### Full Upload Flow (server-side adapter)
```typescript
// Source: github.com/FilOzone/synapse-sdk + github.com/FIL-Builders/fs-upload-dapp
// src/lib/chain/filecoin.ts
import 'server-only'
import { Synapse } from '@filoz/synapse-sdk'
import { getChain } from '@filoz/synapse-core/chains'
import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// Filecoin chain IDs (not EVM Base chain IDs)
const CHAIN_ID = process.env.FILECOIN_NETWORK === 'mainnet' ? 314 : 314159

let _synapse: Synapse | null = null

async function getSynapse(): Promise<Synapse> {
  if (_synapse) return _synapse
  const privateKey = process.env.FILECOIN_PRIVATE_KEY as Hex
  const chain = getChain(CHAIN_ID)
  const account = privateKeyToAccount(privateKey)
  const client = createWalletClient({ account, chain, transport: http() })
  _synapse = new Synapse({ client })
  return _synapse
}

export interface FilecoinUploadResult {
  pieceCid: string
  retrievalUrl: string
}

export async function uploadToFilecoin(
  data: object,
  name: string
): Promise<FilecoinUploadResult> {
  const synapse = await getSynapse()
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2))

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    }
  })

  let resolvedCid: string | undefined

  const context = await synapse.storage.createContext({ withCDN: true })

  await new Promise<void>((resolve, reject) => {
    context.upload(stream, {
      pieceMetadata: { name },
      onPiecesConfirmed(_dataSetId, _providerId, pieces) {
        resolvedCid = pieces[0]?.pieceCid?.toString()
        resolve()
      },
    }).catch(reject)
  })

  if (!resolvedCid) throw new Error(`Filecoin upload failed: no CID for ${name}`)

  return {
    pieceCid: resolvedCid,
    retrievalUrl: `https://cdn.filecoin.cloud/${resolvedCid}`,
  }
}
```

### API Route (server-side orchestration)
```typescript
// Source: ARCHITECTURE.md pattern + filecoin adapter above
// src/app/api/chain/upload/route.ts
import { uploadToFilecoin } from '@/lib/chain/filecoin'

export async function POST(req: Request) {
  const { type, data, name } = await req.json()

  // Validate: type must be one of the three upload types
  const allowed = ['agent_card', 'agent_log', 'nft_metadata'] as const
  if (!allowed.includes(type)) {
    return Response.json({ error: 'Invalid type' }, { status: 400 })
  }

  const result = await uploadToFilecoin(data, name)
  return Response.json(result)
}
```

### Environment Variables Required
```bash
# .env.local
FILECOIN_PRIVATE_KEY=0x...           # Hex private key for hot wallet (server-only, never NEXT_PUBLIC_)
FILECOIN_NETWORK=calibration         # 'calibration' | 'mainnet'
```

### Calibration Testnet Faucets
```
tFIL (gas):   https://faucet.calibration.filecoin.io/
tUSDFC:       https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc
              (also via built-in faucet in FIL-Builders/fs-upload-dapp under wallet menu)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IPFS-only storage (Pinata/web3.storage) | Filecoin Onchain Cloud with on-chain proofs | Nov 2025 (FOC launch) | PieceCID provides cryptographic proof-of-storage; IPFS CIDs don't have on-chain verifiability |
| Pre-v0.24 Synapse API (`createStorageSession`) | Context-based API (`synapse.storage.createContext()`) | v0.24.0 (2025) | Breaking change; old tutorials are wrong |
| Separate FIL payment + storage APIs | Unified `@filoz/synapse-sdk` with embedded payment rails | v0.40.0 (March 2026) | Single SDK handles deposit, approval, upload, retrieval |

**Deprecated/outdated:**
- `SynapseClient` class name: renamed to `Synapse` — any tutorial using `new SynapseClient()` is pre-v0.24
- `createStorageSession()`: replaced by `synapse.storage.createContext()` — same era
- Pre-FOC Filecoin storage (Textile/Estuary): both sunset; use FOC SDK directly

---

## Open Questions

1. **`onPiecesConfirmed` vs `onStored` as the correct "done" signal**
   - What we know: `onStored` fires when the piece is submitted to a provider; `onPiecesConfirmed` fires when PDP proof is verified on-chain
   - What's unclear: Whether retrieval is available at `onStored` time or only at `onPiecesConfirmed` time; the difference matters for user-facing latency
   - Recommendation: Use `onPiecesConfirmed` for the PieceCID stored in SQLite; show "uploading" state until it fires; acceptable for hackathon even if it takes a few minutes

2. **Retrieval URL format for ERC-8004 agentURI**
   - What we know: `https://cdn.filecoin.cloud/<PieceCID>` is the CDN URL when `withCDN: true`; docs mention this URL structure
   - What's unclear: Whether ERC-8004 consumers can retrieve from this URL directly or need the SDK
   - Recommendation: Use `https://cdn.filecoin.cloud/<PieceCID>` as the agentURI in ERC-8004 registration; it's a standard HTTPS URL any consumer can GET

3. **Mainnet USDFC acquisition path**
   - What we know: Mainnet is live; USDFC is a FIL-backed stablecoin; you can mint it using FIL as collateral
   - What's unclear: Exact USDFC mint UI / contract address for mainnet; amount needed for 3-5 agent uploads + NFT metadata
   - Recommendation: Use calibration for all development; acquire mainnet USDFC only if the demo explicitly requires mainnet FOC (verify with hackathon requirements)

4. **`@filoz/synapse-sdk` Node.js compatibility with Next.js 16 App Router**
   - What we know: The CLI example runs in Node.js; `server-only` import guard prevents client bundling
   - What's unclear: Whether any SDK internals use APIs unavailable in Next.js Edge Runtime
   - Recommendation: Keep the adapter in a Node.js API route (not Edge Runtime); do NOT use `export const runtime = 'edge'` on the upload route

---

## Sources

### Primary (HIGH confidence)
- [FilOzone/synapse-sdk GitHub — examples/cli/src/client.ts](https://github.com/FilOzone/synapse-sdk/blob/main/examples/cli/src/client.ts) — Synapse initialization pattern, viem client creation
- [FilOzone/synapse-sdk GitHub — examples/cli/src/commands/upload.ts](https://github.com/FilOzone/synapse-sdk/blob/main/examples/cli/src/commands/upload.ts) — upload API, context creation, PieceCID callbacks
- [FilOzone/synapse-sdk GitHub — packages/synapse-sdk/src/synapse.ts](https://github.com/FilOzone/synapse-sdk/blob/main/packages/synapse-sdk/src/synapse.ts) — `Synapse` constructor signature
- [FilOzone/synapse-sdk GitHub — packages/synapse-core/src/chains.ts](https://github.com/FilOzone/synapse-sdk) — chain IDs (314 mainnet, 314159 calibration), RPC URLs, contract addresses
- [FIL-Builders/fs-upload-dapp GitHub](https://github.com/FIL-Builders/fs-upload-dapp) — full-stack Next.js 16 upload dApp with USDFC deposit flow

### Secondary (MEDIUM confidence)
- [Filecoin Onchain Cloud docs — developer-guides/synapse](https://docs.filecoin.cloud/developer-guides/synapse/) — SDK module overview, payment API surface
- [filecoin.cloud homepage](https://filecoin.cloud/) — mainnet live status confirmed ("Live: 2 independent replicas...")
- [CryptoCalendar — FOC mainnet launch Jan 31, 2026](https://cryptocalendar.ai/events/filecoin-onchain-cloud-mainnet-launch-release-31-01-2026) — mainnet launch date
- [Filecoin Foundation Dec 2025 update](https://fil.org/blog/fresh-from-ff-december-2025) — 100+ teams building, 180 payers, testnet metrics

### Tertiary (LOW confidence)
- [ChainSafe USDFC faucet URL](https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc) — calibration tUSDFC faucet (URL confirmed in search results; page returned 403 so not directly verified)
- WebSearch result claiming `Synapse.create({ privateKey, rpcURL })` static factory — not verified against source (GitHub shows `new Synapse({ client })` constructor pattern instead)

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — SDK v0.40.0 confirmed from GitHub releases; ethers peer dep confirmed from README; API patterns confirmed from CLI example source code
- Architecture: MEDIUM — follows the chain adapter pattern from ARCHITECTURE.md; upload flow verified from examples; retrieval URL format inferred from withCDN flag + CDN URL pattern
- Pitfalls: MEDIUM — PieceCID vs IPFS CID distinction is HIGH (confirmed from Filecoin docs); deposit requirement is HIGH; `onPiecesConfirmed` vs `onStored` timing is LOW (inferred from docs structure, not explicitly documented)

**Research date:** 2026-03-20
**Valid until:** 2026-04-03 (7 days — fast-moving pre-1.0 SDK; check GitHub releases before starting)

**Critical pre-work before coding:**
1. Run `pnpm add @filoz/synapse-sdk ethers` and verify installation resolves without peer dep errors
2. Fund the Filecoin hot wallet with tFIL (gas) AND tUSDFC (storage payment) from calibration faucets
3. Confirm `@filoz/synapse-sdk` version is still 0.40.0 (or update patterns if newer version released)
