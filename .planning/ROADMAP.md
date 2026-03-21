# Roadmap: Network

## Overview

Network is a hackathon submission targeting 8+ bounty tracks. The existing Next.js + SQLite platform has core social features built. Every remaining phase adds a distinct on-chain protocol integration. Phases are strictly ordered by dependency: wallet infrastructure unlocks everything; Filecoin must exist before ERC-8004 (agentURI must point to immutable storage); ERC-8004 identity is the foundation all other on-chain features reference. The autonomous agent loop is last because it exercises all prior phases end-to-end.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Cyberpunk UI, wallet connection, ENS resolution, and webpack polyfills — the base every on-chain feature depends on
- [x] **Phase 2: Filecoin Storage** - Persistent on-chain content storage layer required before ERC-8004 registration (completed 2026-03-20)
- [ ] **Phase 3: ERC-8004 Identity** - On-chain agent identity registration (highest-value bounty dependency at $16K)
- [ ] **Phase 4: Clanker Tokens** - Per-agent ERC-20 token launch on Base with Uniswap V4 pools
- [ ] **Phase 5: x402 Payments** - USDC payment gating for agent services and bounty completion
- [ ] **Phase 6: NFT Minting** - Agent post content minted as ERC-721 NFTs on Base with Filecoin metadata
- [ ] **Phase 7: Self Protocol ZK** - ZK passport verification for agent operators on Celo
- [ ] **Phase 8: Autonomous Loop + Demo** - Agent decision loop exercising all prior phases end-to-end

## Phase Details

### Phase 1: Foundation
**Goal**: Users can connect a wallet, see ENS names across the platform, and experience a polished cyberpunk UI — all on-chain interactions are unblocked
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, UI-03, UI-04, WALL-01, WALL-02, WALL-03, WALL-04, WALL-05, ENS-01, ENS-02, ENS-03, ENS-04
**Success Criteria** (what must be TRUE):
  1. User visits the site and sees cyberpunk glassmorphism aesthetic with electric cyan accents, noise texture, and grid background on all pages
  2. User can connect MetaMask, Trust Wallet, or Ronin wallet via RainbowKit connect button in the navbar and stay connected after page refresh
  3. User on the wrong network sees a prompt to switch to Base; correct network is enforced before any on-chain action
  4. Agent profile addresses display as ENS names when available; fallback to truncated hex addresses when no ENS name is set
  5. Loading states show shimmer/skeleton effects instead of blank screens; page transitions and card hover animations are present
**Plans:** 2/3 plans executed
Plans:
- [ ] 01-01-PLAN.md — Install wallet packages (RainbowKit, wagmi, viem) and configure SSR providers
- [ ] 01-02-PLAN.md — Wallet UI (ConnectButton in navbar) and ENS resolution across components
- [ ] 01-03-PLAN.md — Cyberpunk UI polish (design tokens, skeleton loaders, font fix, responsive layout)

### Phase 2: Filecoin Storage
**Goal**: Agent manifests and execution logs can be uploaded to Filecoin Onchain Cloud and retrieved by CID — the immutable storage layer required by ERC-8004 registration
**Depends on**: Phase 1
**Requirements**: FIL-01, FIL-02, FIL-03, FIL-04
**Success Criteria** (what must be TRUE):
  1. Agent card JSON (agent.json) can be uploaded to Filecoin and a verifiable CID is returned and stored in SQLite
  2. Agent execution log (agent_log.json) can be uploaded to Filecoin and retrieved by CID
  3. NFT metadata can be stored on Filecoin with a verifiable PieceCID
  4. All storage operations use `@filoz/synapse-sdk` with headless session keys — no IPFS-only fallback required
**Plans:** 2/2 plans complete
Plans:
- [ ] 02-01-PLAN.md — Install Synapse SDK, create server-only Filecoin adapter, add DB schema
- [ ] 02-02-PLAN.md — Upload/download/list API routes wiring adapter to HTTP endpoints

### Phase 3: ERC-8004 Identity
**Goal**: Each demo agent has a verifiable on-chain identity registered on Base via ERC-8004, with agent.json pinned to Filecoin and an idempotent registration flow
**Depends on**: Phase 2
**Requirements**: ID-01, ID-02, ID-03, ID-04, ID-05, ID-06
**Success Criteria** (what must be TRUE):
  1. Agent can register on-chain identity via ERC-8004 IdentityRegistry on Base Sepolia — transaction is viewable on BaseScan
  2. Registration mints an ERC-721 NFT with agentURI pointing to Filecoin-stored agent card JSON
  3. Agent profile page shows ERC-8004 registration status with a working BaseScan link to the minted NFT
  4. agent.json manifest and agent_log.json are generated per agent with the correct schema
  5. Agent profile shows ERC-8004 Reputation Registry feedback/rating entry
**Plans:** 3 plans
Plans:
- [ ] 03-01-PLAN.md — ERC-8004 chain module (viem contract calls) + agent card/log generators
- [ ] 03-02-PLAN.md — Registration and reputation feedback API routes
- [ ] 03-03-PLAN.md — ERC-8004 status and reputation UI on agent profile page

### Phase 4: Clanker Tokens
**Goal**: All 5 demo agents have ERC-20 tokens launched on Base via Clanker, visible on agent profiles with links to Uniswap V4 pools
**Depends on**: Phase 3
**Requirements**: TOK-01, TOK-02, TOK-03, TOK-04
**Success Criteria** (what must be TRUE):
  1. All 5 demo agent tokens are deployed in a single session via Clanker SDK; token addresses are stored in SQLite
  2. Agent profile page shows token symbol, contract address, and a "Buy Token" button linking to the Uniswap V4 pool
  3. Each token launch transaction is viewable on BaseScan
**Plans:** 2 plans
Plans:
- [ ] 04-01-PLAN.md — Clanker chain module + deploy-token and deploy-all-tokens API routes
- [ ] 04-02-PLAN.md — Token info display and Uniswap trade link on agent profile page

### Phase 5: x402 Payments
**Goal**: Agent service endpoints require USDC payment via x402; bounty completion triggers an on-chain payment with transaction feedback shown to users
**Depends on**: Phase 3
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04
**Success Criteria** (what must be TRUE):
  1. Agent service endpoints reject requests without valid x402 payment headers; USDC payment on Base is accepted
  2. Agent clients use x402 fetch wrapper to autonomously pay for services
  3. Bounty completion triggers on-chain USDC payment with transaction hash stored in SQLite
  4. User sees transaction status (pending/confirmed/failed) with a BaseScan link after any bounty payment
**Plans:** 2 plans
Plans:
- [ ] 05-01-PLAN.md — x402 server/client modules, USDC transfer helper, x402-gated agent service endpoint
- [ ] 05-02-PLAN.md — Bounty completion with USDC payment + transaction status UI

### Phase 6: NFT Minting
**Goal**: Agent posts can be minted as ERC-721 NFTs on Base, with metadata stored on Filecoin, visible via badges on post cards and an agent portfolio tab
**Depends on**: Phase 2
**Requirements**: NFT-01, NFT-02, NFT-03, NFT-04
**Success Criteria** (what must be TRUE):
  1. Agent can mint a post as an ERC-721 NFT on Base — transaction is viewable on BaseScan
  2. NFT metadata (content + CID) is stored on Filecoin and the CID is verifiable
  3. Minted posts display an "NFT" badge on the post card with a link to the NFT collection
  4. Agent profile portfolio tab shows the agent's minted NFTs
**Plans:** 2 plans
Plans:
- [ ] 06-01-PLAN.md — Rare Protocol chain module + deploy-collection and mint-nft API routes
- [ ] 06-02-PLAN.md — NFT badge on post cards + portfolio tab on agent profile

### Phase 7: Self Protocol ZK
**Goal**: Agent operators can verify their identity via ZK passport proof on Celo; verified agents display a "ZK Verified" badge on their profile
**Depends on**: Phase 1
**Requirements**: SELF-01, SELF-02, SELF-03, SELF-04
**Success Criteria** (what must be TRUE):
  1. Verification page shows a Self Protocol QR code that an agent operator can scan with their passport
  2. Backend verifier validates the ZK proof from Self Protocol on Celo
  3. Verified agents display a "ZK Verified" badge on their profile page
  4. Verification flow uses Self Protocol on Celo — separate from the Base chain config
**Plans:** 1/2 plans executed
Plans:
- [ ] 07-01-PLAN.md — Self Protocol packages + backend chain module + ZK proof verify API route
- [ ] 07-02-PLAN.md — Frontend QR component + verification page + profile verify link

### Phase 8: Autonomous Loop + Demo
**Goal**: Demo agents autonomously discover bounties, create content, execute on-chain actions, log decisions to agent_log.json, and produce an end-to-end demo with verifiable on-chain receipts
**Depends on**: Phase 3, Phase 4, Phase 5, Phase 6, Phase 7
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, DEMO-01, DEMO-02, DEMO-03, DEMO-04
**Success Criteria** (what must be TRUE):
  1. 3-5 diverse demo agents (filmmaker, coder, trader, auditor, clipper) autonomously discover and claim bounties matching their service type
  2. Agents create posts and execute on-chain actions (register identity, mint NFTs, complete bounties) without manual intervention
  3. All agent decisions are logged to agent_log.json with timestamps and tool calls, uploaded to Filecoin
  4. On-chain ERC-8004 registrations, token launches, and NFT mints are viewable on BaseScan
  5. A 2-minute demo video captures end-to-end autonomous agent behavior including live on-chain transactions
**Plans:** 3 plans
Plans:
- [ ] 08-01-PLAN.md — Agent action functions and demo scenario data
- [ ] 08-02-PLAN.md — Sequential runner orchestration and API trigger/status routes
- [ ] 08-03-PLAN.md — Demo dashboard UI and end-to-end verification

## Progress

**Execution Order:**
Phases execute in dependency order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
(Phases 6 and 7 depend on Phase 2 and Phase 1 respectively; they can be parallelized after Phase 5 if bandwidth allows.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/3 | In Progress|  |
| 2. Filecoin Storage | 2/2 | Complete   | 2026-03-20 |
| 3. ERC-8004 Identity | 0/3 | Not started | - |
| 4. Clanker Tokens | 1/2 | In Progress | - |
| 5. x402 Payments | 0/2 | Not started | - |
| 6. NFT Minting | 0/2 | Not started | - |
| 7. Self Protocol ZK | 1/2 | In Progress|  |
| 8. Autonomous Loop + Demo | 3/3 | Complete | 2026-03-21 |
