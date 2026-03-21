# Phase 6: NFT Minting - Research

**Researched:** 2026-03-21
**Domain:** ERC-721 NFT minting on Base via Rare Protocol + Filecoin metadata storage
**Confidence:** HIGH

## Summary

Phase 6 mints agent post content as ERC-721 NFTs on Base using the `@rareprotocol/rare-cli` SDK. The previously noted blocker (`@rareprotocol/rare-cli` not found on npm) is **resolved** -- the package exists at version 0.3.0, published 2026-03-20, with full Base/Base Sepolia support and a programmatic `createRareClient` API. The SDK handles contract deployment, IPFS media upload, and minting in a clean API that integrates with the project's existing viem wallet/public clients.

The existing codebase is well-prepared: the `posts` table already has `nft_contract`, `nft_token_id`, and `filecoin_cid` columns; the `agents` table has `nft_collection_address`; the Filecoin upload route already accepts `nft_metadata` type; and the agent profile page already has a "portfolio" tab placeholder. The post-card component has a basic NFT badge stub. This phase fills in the chain module, API routes, and UI components.

**Primary recommendation:** Use `@rareprotocol/rare-cli/client` programmatic SDK with the project's existing viem clients. Deploy one ERC-721 collection per agent, mint posts into that collection, store ERC-721 metadata JSON on Filecoin before minting.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NFT-01 | Agent can mint post content as ERC-721 NFT on Base | `createRareClient` + `rare.mint.mintTo()` on Base Sepolia via SovereignBatchMintFactory |
| NFT-02 | NFT metadata stored on Filecoin with verifiable CID | Existing `uploadToFilecoin()` with `nft_metadata` type, CID stored in `filecoin_uploads` table |
| NFT-03 | Minted posts show "NFT" badge and link to collection | Post already has `nft_contract`/`nft_token_id` fields; badge stub exists in post-card.tsx |
| NFT-04 | Agent profile portfolio tab shows minted NFTs | Profile page already has `portfolio` tab with placeholder; query posts WHERE nft_contract IS NOT NULL |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@rareprotocol/rare-cli` | 0.3.0 | ERC-721 deploy + mint on Base | SuperRare bounty track requirement ($2.5K); has programmatic SDK with `createRareClient` |
| `viem` | ^2.47.5 | Wallet/public client (already installed) | Powers all chain modules in this project |
| `@filoz/synapse-sdk` | ^0.40.0 | NFT metadata storage on Filecoin (already installed) | FIL-03 already complete; reuse existing `uploadToFilecoin()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `better-sqlite3` | ^12.8.0 | Store NFT contract/token data (already installed) | DB schema already has NFT columns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rare Protocol | OpenZeppelin ERC-721 + custom deploy | No bounty value; more code; no SuperRare marketplace listing |
| Rare Protocol | Zora Protocol | Different bounty track; Rare Protocol is explicitly required for SuperRare bounty |

**Installation:**
```bash
pnpm add @rareprotocol/rare-cli
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/chain/nft.ts           # Rare Protocol chain module (deploy + mint)
├── app/api/chain/
│   ├── deploy-collection/route.ts   # POST: deploy ERC-721 per agent
│   └── mint-nft/route.ts            # POST: mint post as NFT
├── components/profile/
│   └── nft-portfolio.tsx       # Portfolio tab content
└── components/feed/
    └── post-card.tsx           # Enhanced with NFT badge + link (already has stub)
```

### Pattern 1: Chain Module (Rare Protocol Client)
**What:** Server-only module creating a `RareClient` from project's existing viem wallet/public client pattern
**When to use:** All NFT operations (deploy collection, mint token)
**Example:**
```typescript
// Source: https://github.com/superrare/rare-cli README
import 'server-only'
import { createRareClient } from '@rareprotocol/rare-cli/client'
import { createWalletClient, createPublicClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

function getRareClient() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as Hex
  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() })
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })
  return createRareClient({ publicClient, walletClient })
}
```

### Pattern 2: Mint Flow (Filecoin metadata first, then on-chain mint)
**What:** Upload ERC-721 metadata JSON to Filecoin, get CID, use CID as tokenURI, mint on-chain
**When to use:** Every mint operation
**Example:**
```typescript
// 1. Build ERC-721 metadata
const metadata = {
  name: `Post by ${agent.display_name}`,
  description: post.content,
  external_url: `https://network.app/agent/${agent.id}`,
  attributes: [
    { trait_type: "Agent", value: agent.display_name },
    { trait_type: "Service Type", value: agent.service_type },
  ],
}

// 2. Upload metadata to Filecoin (reuse existing adapter)
const filResult = await uploadToFilecoin(metadata, `nft_${postId}.json`)

// 3. Mint with tokenURI pointing to Filecoin CDN
const rare = getRareClient()
const result = await rare.mint.mintTo({
  contract: agent.nft_collection_address,
  to: agent.wallet_address,
  tokenUri: filResult.retrievalUrl,  // https://cdn.filecoin.cloud/{cid}
})

// 4. Update post record with NFT data
db.prepare('UPDATE posts SET nft_contract = ?, nft_token_id = ?, filecoin_cid = ? WHERE id = ?')
  .run(collectionAddress, tokenId, filResult.pieceCid, postId)
```

### Pattern 3: One Collection Per Agent
**What:** Each agent deploys a single ERC-721 collection, all their posts mint into it
**When to use:** Agent's first mint triggers collection deploy; subsequent mints reuse it
**Example:**
```typescript
// Deploy once, store address in agents.nft_collection_address
const rare = getRareClient()
// rare deploy erc721 equivalent:
const { contractAddress, txHash } = await rare.deploy.erc721(
  `${agent.display_name} Collection`,
  agent.display_name.substring(0, 5).toUpperCase()
)
db.prepare('UPDATE agents SET nft_collection_address = ? WHERE id = ?')
  .run(contractAddress, agent.id)
```

### Anti-Patterns to Avoid
- **Deploying a new collection per mint:** Wastes gas, fragments agent's NFT presence. One collection per agent.
- **Minting without Filecoin metadata first:** TokenURI must point to immutable storage for hackathon judging (NFT-02).
- **Skipping DB update after mint:** The UI reads `nft_contract`/`nft_token_id` from the posts table; forgetting to update means no badge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ERC-721 contract deployment | Custom Solidity + deploy script | `rare.deploy.erc721()` | Factory pattern handles bytecode, verification, SuperRare marketplace compatibility |
| NFT minting | Raw writeContract with ERC-721 ABI | `rare.mint.mintTo()` | Handles token ID assignment, event parsing, media upload |
| IPFS/metadata hosting | Custom IPFS pinning | Filecoin via `uploadToFilecoin()` (existing) | Already built, PDP-verified, CDN-backed |
| NFT marketplace listing | Custom marketplace UI | SuperRare/BaseScan links | Out of scope; link to existing explorers |

**Key insight:** The rare-cli SDK wraps the SovereignBatchMintFactory contracts already deployed on Base Sepolia. Using the SDK means the NFTs are automatically discoverable on SuperRare's network, which matters for the bounty.

## Common Pitfalls

### Pitfall 1: Import Path for Programmatic SDK
**What goes wrong:** Importing from `@rareprotocol/rare-cli` instead of `@rareprotocol/rare-cli/client`
**Why it happens:** Top-level export is the CLI binary, not the SDK
**How to avoid:** Always use `import { createRareClient } from '@rareprotocol/rare-cli/client'`
**Warning signs:** "createRareClient is not exported" error

### Pitfall 2: Collection Not Deployed Before Mint
**What goes wrong:** Attempting to mint to a null collection address
**Why it happens:** Agent has no `nft_collection_address` yet
**How to avoid:** Check `agent.nft_collection_address`; if null, deploy first then mint. Make the API route handle both cases.
**Warning signs:** Contract call reverts with zero address

### Pitfall 3: Filecoin Upload Latency
**What goes wrong:** Mint API appears to hang for 30+ seconds
**Why it happens:** `uploadToFilecoin` waits for `onPiecesConfirmed` (PDP proof), which takes time
**How to avoid:** Document expected latency; the upload route already handles this correctly. Consider returning a pending status and polling if needed for demo.
**Warning signs:** Timeout errors on the mint endpoint

### Pitfall 4: TokenURI Must Be a URL, Not a CID
**What goes wrong:** Setting tokenURI to a bare PieceCID instead of a retrievable URL
**Why it happens:** Confusing Filecoin CID with HTTP-accessible URL
**How to avoid:** Use `retrievalUrl` (e.g., `https://cdn.filecoin.cloud/{cid}`) as tokenURI, not the raw `pieceCid`
**Warning signs:** NFT metadata not loading in explorers/wallets

### Pitfall 5: rare-cli SDK Method Names
**What goes wrong:** Guessing method signatures that don't match actual API
**Why it happens:** Package is new (published yesterday); training data won't have it
**How to avoid:** After installing, inspect the actual exports: `ls node_modules/@rareprotocol/rare-cli/client/` and read type definitions. Verify `createRareClient`, `mint.mintTo`, `deploy.erc721` exist.
**Warning signs:** TypeScript compilation errors on SDK calls

## Code Examples

### ERC-721 Metadata JSON (Standard)
```typescript
// Source: ERC-721 Metadata JSON Schema (EIP-721)
interface NFTMetadata {
  name: string
  description: string
  image?: string          // Optional for text-only posts
  external_url?: string   // Link back to Network platform
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
}
```

### NFT Badge on Post Card (Enhancement)
```typescript
// Source: existing post-card.tsx pattern, enhanced
{post.nft_contract && (
  <a
    href={`https://sepolia.basescan.org/token/${post.nft_contract}?a=${post.nft_token_id}`}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
  >
    NFT #{post.nft_token_id}
  </a>
)}
```

### Portfolio Tab Query
```typescript
// Fetch agent's minted NFTs (posts with nft_contract set)
const nftPosts = db.prepare(`
  SELECT p.*, a.display_name as agent_display_name, a.avatar_url as agent_avatar_url, a.service_type as agent_service_type
  FROM posts p
  JOIN agents a ON p.agent_id = a.id
  WHERE p.agent_id = ? AND p.nft_contract IS NOT NULL
  ORDER BY p.created_at DESC
`).all(agentId)
```

## Rare Protocol Contract Addresses

| Network | Factory | Auction |
|---------|---------|---------|
| Base Sepolia | `0x2b181ae0f1aea6fed75591b04991b1a3f9868d51` | `0x1f0c946f0ee87acb268d50ede6c9b4d010af65d2` |
| Base | `0xf776204233bfb52ba0ddff24810cbdbf3dbf94dd` | `0x51c36ffb05e17ed80ee5c02fa83d7677c5613de2` |

Use Base Sepolia for development; the SDK handles factory selection via the chain in the viem client.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom Solidity deploy | Rare Protocol factory SDK | 2026-03 (rare-cli 0.3.0) | No custom contracts needed |
| IPFS-only metadata | Filecoin PDP-verified storage | Project Phase 2 | CID is verifiable on-chain via PDP |
| Manual ABI interaction | `createRareClient` programmatic API | rare-cli 0.3.0 | Clean SDK wrapping deploy/mint/search |

**Blocker Resolution:**
- STATE.md noted: "`@rareprotocol/rare-cli` not found on npm"
- **Status: RESOLVED** -- Package exists at 0.3.0 (published 2026-03-20). `npm show @rareprotocol/rare-cli` returns valid metadata.

## Existing Codebase Readiness

The codebase is well-prepared for this phase:

| Feature | Status | Location |
|---------|--------|----------|
| `posts.nft_contract` column | EXISTS | `src/lib/db.ts` |
| `posts.nft_token_id` column | EXISTS | `src/lib/db.ts` |
| `posts.filecoin_cid` column | EXISTS | `src/lib/db.ts` |
| `agents.nft_collection_address` column | EXISTS | `src/lib/db.ts` |
| NFT badge stub on post card | EXISTS | `src/components/feed/post-card.tsx:34-37` |
| Portfolio tab placeholder | EXISTS | `src/app/agent/[id]/page.tsx:207` |
| Filecoin `nft_metadata` upload type | EXISTS | `src/types/filecoin.ts`, `src/app/api/chain/upload/route.ts` |
| `uploadToFilecoin()` adapter | EXISTS | `src/lib/chain/filecoin.ts` |
| Viem wallet/public client pattern | EXISTS | `src/lib/chain/erc8004.ts` (reuse pattern) |

## Open Questions

1. **SDK Programmatic API Exact Signatures**
   - What we know: `createRareClient`, `mint.mintTo()`, `deploy.erc721()` documented in README
   - What's unclear: Exact TypeScript return types, error handling patterns (package is 1 day old)
   - Recommendation: After `pnpm add`, inspect `node_modules/@rareprotocol/rare-cli/client/` type definitions. If SDK API doesn't match docs, fall back to CLI subprocess calls or direct viem contract interaction with factory addresses.

2. **Media Upload for Non-Text Posts**
   - What we know: `rare.media.upload()` accepts Uint8Array/Buffer
   - What's unclear: Whether we need media upload for text-only agent posts
   - Recommendation: For hackathon, mint text posts only (no image). Set `image` in metadata to null or a default agent avatar. Simplifies implementation significantly.

## Sources

### Primary (HIGH confidence)
- npm registry: `npm show @rareprotocol/rare-cli` -- version 0.3.0, deps, supported chains
- GitHub README: `https://github.com/superrare/rare-cli` -- programmatic API, contract addresses, CLI commands
- Existing codebase: `src/lib/db.ts`, `src/lib/chain/filecoin.ts`, `src/lib/chain/erc8004.ts` -- patterns and schema

### Secondary (MEDIUM confidence)
- SuperRare Developer Docs: `https://developer.superrare.com/smart-contracts/assets/` -- Series NFT contract info (SSL issue prevented direct fetch)

### Tertiary (LOW confidence)
- SDK method signatures (`createRareClient`, `mint.mintTo`, `deploy.erc721`) -- documented in README but package is 1 day old; **must verify after install by reading type definitions**

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Package confirmed on npm, contract addresses verified, Base support documented
- Architecture: HIGH - Follows exact same chain module + API route + UI pattern as phases 3-5
- Pitfalls: MEDIUM - SDK is very new; method signatures need post-install verification

**Research date:** 2026-03-21
**Valid until:** 2026-04-07 (14 days -- SDK is new and may change)
