---
phase: 06-nft-minting
verified: 2026-03-21T05:00:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 6: NFT Minting Verification Report

**Phase Goal:** Agent posts can be minted as ERC-721 NFTs on Base, with metadata stored on Filecoin, visible via badges on post cards and an agent portfolio tab
**Verified:** 2026-03-21T05:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent can deploy an ERC-721 collection on Base Sepolia via Rare Protocol | VERIFIED | `src/lib/chain/nft.ts` exports `deployCollection` calling `rare.deploy.erc721()`; `deploy-collection/route.ts` wires it to POST endpoint with DB persistence |
| 2 | Agent can mint a post as an NFT with metadata stored on Filecoin | VERIFIED | `mint-nft/route.ts` builds ERC-721 metadata JSON, uploads via `uploadToFilecoin`, then calls `mintPostNFT` with Filecoin retrievalUrl as tokenURI |
| 3 | Collection address is persisted in agents.nft_collection_address | VERIFIED | DB schema has `nft_collection_address TEXT` column; deploy-collection route runs `UPDATE agents SET nft_collection_address = ?` |
| 4 | Minted NFT contract and token ID are persisted in posts table | VERIFIED | DB schema has `nft_contract TEXT, nft_token_id TEXT`; mint-nft route runs `UPDATE posts SET nft_contract = ?, nft_token_id = ?, filecoin_cid = ?` |
| 5 | Minted posts display a clickable NFT badge with BaseScan link | VERIFIED | `post-card.tsx` lines 34-43: conditional `<a>` tag with `href=https://sepolia.basescan.org/token/${post.nft_contract}?a=${post.nft_token_id}` |
| 6 | Agent profile portfolio tab shows all minted NFTs for that agent | VERIFIED | `agent/[id]/page.tsx` line 210: `<NFTPortfolio posts={nftPosts} />` rendered in portfolio tab; `nft-portfolio.tsx` renders responsive grid with BaseScan links |
| 7 | Portfolio tab queries posts with nft_contract IS NOT NULL | VERIFIED | `agent/[id]/page.tsx` line 24 fetches `/api/posts?agent_id=${id}&nft_only=true`; `posts/route.ts` line 26 adds `p.nft_contract IS NOT NULL` condition |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/chain/nft.ts` | Rare Protocol chain module with deployCollection and mintPostNFT | VERIFIED | 69 lines, server-only, exports both functions, uses createRareClient with viem on baseSepolia |
| `src/app/api/chain/deploy-collection/route.ts` | POST endpoint to deploy ERC-721 collection for an agent | VERIFIED | 50 lines, exports POST, idempotent (returns existing if nft_collection_address set), DB persistence, 502 error handling |
| `src/app/api/chain/mint-nft/route.ts` | POST endpoint to mint post as NFT with Filecoin metadata | VERIFIED | 136 lines, exports POST, idempotent, auto-deploys collection, uploads metadata to Filecoin, records in filecoin_uploads, 502 error handling |
| `src/components/feed/post-card.tsx` | Enhanced NFT badge with BaseScan link and token ID | VERIFIED | Clickable `<a>` tag with `sepolia.basescan.org/token` href, purple accent styling, shows "NFT #{tokenId}" |
| `src/components/profile/nft-portfolio.tsx` | NFT portfolio grid component | VERIFIED | 55 lines, exports NFTPortfolio, responsive grid (1/2/3 cols), empty state, BaseScan links, Filecoin indicator, timeAgo helper |
| `src/app/agent/[id]/page.tsx` | Portfolio tab wired to NFTPortfolio component | VERIFIED | Imports NFTPortfolio, fetches nftPosts with nft_only=true, renders in portfolio tab |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mint-nft/route.ts` | `src/lib/chain/nft.ts` | `import mintPostNFT` | WIRED | Line 1: `import { deployCollection, mintPostNFT } from '@/lib/chain/nft'` |
| `mint-nft/route.ts` | `src/lib/chain/filecoin.ts` | `import uploadToFilecoin` | WIRED | Line 2: `import { uploadToFilecoin } from '@/lib/chain/filecoin'`; used at line 83 |
| `src/lib/chain/nft.ts` | `@rareprotocol/rare-cli/client` | `createRareClient` | WIRED | Line 2: `import { createRareClient } from '@rareprotocol/rare-cli/client'`; SDK installed in node_modules |
| `agent/[id]/page.tsx` | `nft-portfolio.tsx` | `import NFTPortfolio` | WIRED | Line 10: `import { NFTPortfolio } from '@/components/profile/nft-portfolio'`; rendered at line 210 |
| `nft-portfolio.tsx` | posts API with nft_only | fetch in agent page | WIRED | Agent page line 24: `fetch(/api/posts?agent_id=${id}&nft_only=true)`; posts API line 26: `p.nft_contract IS NOT NULL` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NFT-01 | 06-01 | Agent can mint post content as ERC-721 NFT on Base | SATISFIED | `nft.ts` deployCollection + mintPostNFT; `mint-nft/route.ts` full mint flow with DB persistence |
| NFT-02 | 06-01 | NFT metadata stored on Filecoin with verifiable CID | SATISFIED | `mint-nft/route.ts` lines 69-91: builds metadata JSON, uploads via uploadToFilecoin, stores pieceCid in posts.filecoin_cid |
| NFT-03 | 06-02 | Minted posts show "NFT" badge and link to collection | SATISFIED | `post-card.tsx` lines 34-43: clickable badge with BaseScan link and token ID |
| NFT-04 | 06-02 | Agent profile portfolio tab shows minted NFTs | SATISFIED | `nft-portfolio.tsx` grid component + `agent/[id]/page.tsx` wiring with nft_only fetch |

No orphaned requirements found -- all 4 requirement IDs (NFT-01 through NFT-04) from REQUIREMENTS.md Phase 6 mapping are claimed by plans and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/chain/nft.ts` | 17-18 | `as any` type assertion for viem client compatibility | Info | Documented deviation; structurally compatible types across viem versions |

No TODOs, FIXMEs, placeholders, empty implementations, or console.log-only handlers found in any phase 6 files.

### Human Verification Required

### 1. NFT Minting End-to-End

**Test:** Call POST /api/chain/mint-nft with a valid postId; verify transaction on BaseScan
**Expected:** NFT minted on Base Sepolia, transaction hash returned, metadata viewable at Filecoin retrievalUrl
**Why human:** Requires live blockchain interaction with AGENT_PRIVATE_KEY and Rare Protocol service

### 2. NFT Badge Display

**Test:** View a post card for a post with nft_contract set in the database
**Expected:** Purple "NFT #X" badge appears, clicking opens BaseScan token page in new tab
**Why human:** Visual rendering and external link behavior

### 3. Portfolio Tab Rendering

**Test:** Navigate to agent profile, click "portfolio" tab for an agent with minted NFTs
**Expected:** Responsive grid of NFT cards with content previews, BaseScan links, and Filecoin indicators
**Why human:** Visual layout, responsive behavior, empty state appearance

### Gaps Summary

No gaps found. All 7 observable truths verified. All 6 artifacts exist, are substantive (no stubs), and are properly wired. All 4 requirement IDs (NFT-01 through NFT-04) are satisfied. The Rare Protocol SDK is installed. Database schema includes all required columns. The nft_only API filter is implemented for portfolio queries.

---

_Verified: 2026-03-21T05:00:00Z_
_Verifier: Claude (gsd-verifier)_
