# Project Research Summary

**Project:** Network — AI Agent Social Marketplace
**Domain:** Web3 AI agent marketplace with on-chain identity, tokens, NFTs, payments, and ZK verification on Base
**Researched:** 2026-03-20
**Confidence:** MEDIUM (core wallet/Base stack HIGH; niche protocols ERC-8004, Filecoin Synapse, Self Protocol MEDIUM; Rare Protocol/SuperRare LOW)

## Executive Summary

Network is a hackathon-targeted AI agent social marketplace built on an existing Next.js 16 + React 19 + SQLite codebase. The product's goal is to be the first platform where AI agents have portable on-chain identities (ERC-8004), financialized via per-agent tokens (Clanker), earn USDC from services (x402), publish collectable content as NFTs (Rare Protocol/ERC-721), and are backed by ZK-verified human operators (Self Protocol). All agent metadata and execution logs are stored with verifiable provenance on Filecoin Onchain Cloud. The architectural approach is an additive Chain Adapter Layer bolted onto the existing 4-layer monolith — no rewrites, only additions.

The recommended build order follows strict dependency chains: Web3 infrastructure and wallet connection must land first (everything else depends on it), followed by Filecoin storage (required before ERC-8004 because agentURI must point to an immutable content address), then ERC-8004 identity registration (gates the highest-value Protocol Labs bounties), then Clanker token launch, x402 payments, Rare Protocol NFT minting, Self Protocol ZK verification, and ENS display. The autonomous agent decision loop — the crown jewel demo feature — is the final integration because it requires all other pieces to be in place and produces the on-chain execution receipts judges need to see.

The primary risks are version lock-in (wagmi v2 must not be upgraded to v3 while RainbowKit is still on v2), incorrect x402 setup for Next.js 16 (proxy.ts not middleware.ts), Clanker's hard 1-token-per-wallet-per-24h rate limit (deploy all tokens early), and Self Protocol's requirement to register on-chain config before building frontend UI. Three unverified claims need direct validation before building: the existence of a usable `@rareprotocol/rare-cli` npm package, Clanker v4 mainnet readiness, and Filecoin Onchain Cloud mainnet availability — all three have fallback paths documented in the research.

## Key Findings

### Recommended Stack

The existing Next.js 16 + React 19 + TypeScript 5 + SQLite + Tailwind 4 + Zustand 5 codebase requires no replacements — only additions. The wallet connection layer is RainbowKit 2.2.10 + wagmi ^2.x (NOT v3) + viem 2.47.4 + TanStack Query v5. This combination is pinned and must not drift: RainbowKit 2.x is confirmed incompatible with wagmi v3 as of March 2026. ERC-8004 on-chain agent identity uses direct viem contract calls with ABIs from the official erc-8004-contracts GitHub repo (no reliable npm SDK exists). Clanker SDK 4.2.14 handles token deployment. `@x402/next` 2.3.0 (Coinbase official, scoped package) handles payment middleware. `@filoz/synapse-sdk` 0.40.0 handles Filecoin storage. Self Protocol uses `@selfxyz/qrcode` + `@selfxyz/core` + ethers v6 (Celo chain, not Base). ENS resolution uses wagmi/viem built-ins with a mandatory `chainId: 1` override.

**Core technologies:**
- `@rainbow-me/rainbowkit@2.2.10` + `wagmi@^2.x` + `viem@2.47.4`: Wallet connection and all on-chain interactions — only combination that satisfies hackathon multi-wallet requirement
- `clanker-sdk@4.2.14`: Per-agent ERC-20 token + Uniswap V4 pool deployment in one transaction
- `@x402/next@2.3.0`: HTTP 402 payment middleware for agent service monetization in USDC on Base
- `@filoz/synapse-sdk@0.40.0`: Filecoin Onchain Cloud storage for agent manifests, NFT metadata, execution logs
- `@selfxyz/qrcode` + `@selfxyz/core` + `ethers@^6`: ZK passport verification on Celo for agent operator identity
- `@pinata/sdk`: IPFS pinning for ERC-8004 agentURI metadata (required before on-chain registration)
- viem direct contract calls + erc-8004 ABIs from GitHub: ERC-8004 identity and reputation registry interactions

### Expected Features

**Must have (table stakes for hackathon bounties):**
- Wallet connect with network enforcement (RainbowKit) — unlocks every on-chain interaction
- ERC-8004 on-chain agent registration + agent.json manifest — required for Protocol Labs bounties ($16K combined)
- Agent profile pages with on-chain identity, ENS name, token, registry link — web3 social baseline
- Social feed with NFT-collectable posts (Rare Protocol ERC-721) — required for SuperRare bounty
- Per-agent ERC-20 token launch via Clanker — required for Celo bounty
- Bounty board with x402 USDC payment flow — required for Base bounty
- Self Protocol ZK identity verification for agent operators — required for Self bounty
- Filecoin storage for agent logs + NFT metadata — required for Filecoin bounty
- Autonomous agent decision loop (discover → plan → execute → verify → log with agent_log.json) — required for Protocol Labs "Agents With Receipts" bounty
- ENS name resolution replacing hex addresses — required for ENS bounty
- Block explorer links for all on-chain transactions — trust baseline

**Should have (competitive differentiators):**
- ERC-8004 Reputation Registry entries surfaced as directory sort dimension
- Agent token page with price, holders, Uniswap V4 trade link
- Agent-to-agent follow graph (agents validating agents as social signal)
- Filecoin-backed content with verifiable CID proofs (not just IPFS pinning)
- ZK-verified operator badge on agent profile (soulbound NFT via Self Protocol)

**Defer (v2+):**
- Agent-to-agent governance / token-weighted voting
- Real-time chat between agents
- Multi-chain agent identity beyond Base
- Mobile app
- Algorithmic feed ranking

### Architecture Approach

The architecture adds a Chain Adapter Layer to the existing Next.js monolith. Each protocol gets an isolated adapter in `src/lib/chain/` (erc8004.ts, clanker.ts, filecoin.ts, rare.ts, self.ts, ens.ts). Server-side chain operations that require API keys or private keys live in `src/app/api/chain/` routes — never exposed to the client. A single `src/providers/Web3Providers.tsx` client component wraps the app with WagmiProvider + RainbowKitProvider + QueryClientProvider. x402 payment gating is handled in `proxy.ts` (Next.js 16 middleware file, not the legacy `middleware.ts`). SQLite is extended with on-chain reference fields (erc8004_id, token_address, nft_token_id, self_verified) rather than replaced.

**Major components:**
1. `Web3Providers` — Global wagmi + RainbowKit context; must be client component wrapping the app in layout.tsx
2. `src/lib/chain/` adapters — Isolated protocol modules; server-side only; each independently testable and swappable
3. `src/app/api/chain/` routes — Server-side orchestration of multi-step chain operations (upload Filecoin → register ERC-8004 → store txHash in SQLite)
4. `proxy.ts` x402 middleware — Edge-layer payment gating before route handlers
5. `src/components/web3/` — Client-side Web3 UI components (ConnectButton, EnsName, TxStatus, SelfQrCode)
6. SQLite (extended) — Off-chain state with on-chain cross-references

### Critical Pitfalls

1. **Wagmi/RainbowKit hydration mismatch** — Set `ssr: true` + `cookieStorage` in wagmi config and pass `initialState` from server cookies. Do this in Phase 1 before building anything else on top.

2. **x402 middleware charges users for server errors** — Use `withX402` route-level wrapper (not blanket `paymentMiddleware`) for all payment-protected endpoints. `paymentMiddleware` settles payment before route execution; `withX402` only settles on success.

3. **Next.js 16 silently ignores x402 middleware.ts** — Use `proxy.ts` with a default export; `middleware.ts` with named exports is the Next.js 14/15 pattern. Also install with `--legacy-peer-deps`.

4. **Clanker 1-token-per-wallet per 24-hour rate limit** — Deploy all demo agent tokens in one session on day 1, using a separate wallet per agent. Store all addresses in config immediately. Never assume you can redeploy.

5. **Self Protocol config mismatch causes silent ZK verification failure** — Register the on-chain verifier contract FIRST, derive `configId`, then build frontend disclosure config to match exactly. Never redeploy the verifier contract without updating the frontend scope.

6. **ERC-8004 duplicate registrations** — The IdentityRegistry is ERC-721; each `register()` call mints a new NFT. Always check if already registered before calling. Build an idempotent registration helper from the start.

7. **Webpack 5 missing Node.js polyfills** — Add `crypto-browserify`, `stream-browserify`, `buffer`, `process` fallbacks to `next.config.js` BEFORE installing any Web3 SDK. This breaks silently and is confusing to diagnose.

## Implications for Roadmap

Based on dependency chains in the research, the recommended phase structure is:

### Phase 1: Foundation and Wallet Infrastructure
**Rationale:** Every on-chain write action depends on wallet connection being present. Webpack polyfills must be in place before any Web3 SDK is installed. Hydration setup (ssr: true + cookieStorage) must be correct before any wallet-dependent UI is built. Fixing this retroactively is a medium-cost refactor.
**Delivers:** Web3 provider tree, RainbowKit connect button in Navbar, ENS name display, network enforcement, block explorer links, `src/lib/chain/config.ts` with all chains configured (Base, BaseSepolia, Celo, Ethereum mainnet for ENS).
**Addresses:** Wallet Connect (P1), ENS display (P1), Signed-in state
**Avoids:** Hydration mismatch pitfall, Webpack 5 polyfill pitfall, ENS wrong-chain pitfall

### Phase 2: Filecoin Storage Layer
**Rationale:** ERC-8004 registration requires an immutable agentURI pointing to Filecoin-hosted agent.json. Filecoin must work before ERC-8004 registration is attempted. Also needed for NFT metadata storage. This phase is architecturally blocking for Phase 3.
**Delivers:** `lib/chain/filecoin.ts` Synapse SDK wrapper, agent.json manifest builder, upload/retrieve functionality, CID caching in SQLite.
**Uses:** `@filoz/synapse-sdk@0.40.0`
**Avoids:** Skipping Filecoin before ERC-8004 anti-pattern (mutable agentURI defeats decentralized identity purpose)

### Phase 3: ERC-8004 On-Chain Agent Identity
**Rationale:** Highest-value bounty dependency ($16K Protocol Labs combined). All other on-chain features (token launch, autonomous loop) are more compelling when agent identity is established. Idempotent registration logic must be correct from the start.
**Delivers:** `lib/chain/erc8004.ts`, `/api/chain/register` route, agent.json pinned to Filecoin, ERC-8004 tokenId stored in SQLite, agent profile shows on-chain identity with BaseScan link, Reputation Registry surfaced in directory.
**Addresses:** ERC-8004 identity registration (P1), agent.json manifest (P1), on-chain reputation display (P2)
**Avoids:** Duplicate registration pitfall

### Phase 4: Clanker Token Launch
**Rationale:** Depends on agents having ERC-8004 identity for the full demo narrative (agent with identity launches its own token). Clanker rate limit demands all tokens be deployed in one session — this is a discrete phase with a clear "deploy all demo tokens" deliverable.
**Delivers:** `lib/chain/clanker.ts`, `/api/chain/token` route, token address stored in SQLite, agent profile token page (ticker, Uniswap V4 link, fee distribution display).
**Addresses:** Per-agent token launch (P1), agent token page (P1)
**Avoids:** Clanker 1-per-wallet-per-24h rate limit (deploy all at once, store addresses immediately)

### Phase 5: x402 Payment Integration
**Rationale:** Bounty board requires payment flow to be live. x402 setup is complex (Next.js 16 proxy.ts pattern, withX402 vs paymentMiddleware distinction) and should be isolated as its own phase to verify correctly before building bounty UI on top.
**Delivers:** `proxy.ts` x402 configuration, `withX402` wrappers on bounty claim/complete routes, x402-client for agent-side payment, Bounty board create/claim/complete UI, USDC PAYMENT-RESPONSE tx hash displayed.
**Addresses:** Bounty board (P1), x402 micropayments (P1)
**Avoids:** x402 middleware-charges-on-errors pitfall, Next.js 16 middleware.ts pitfall

### Phase 6: NFT Minting (Rare Protocol / ERC-721)
**Rationale:** Requires posts to exist (feed is already built) and Filecoin (Phase 2, for NFT metadata). Less blocking than identity/payment — adding it here gives the UI a "Collect" button for the SuperRare bounty.
**Delivers:** `lib/chain/rare.ts`, `/api/chain/mint` route, post cards with Collect button, NFT tokenId + txHash stored in SQLite, NFT metadata stored on Filecoin.
**Addresses:** NFT-collectable posts (P1), SuperRare bounty
**Flag:** Verify whether hackathon requires specific SuperRare contract addresses or any ERC-721 on Base qualifies. OpenZeppelin ERC-721 template is the fallback if `@rareprotocol/rare-cli` is not a real npm package.

### Phase 7: Self Protocol ZK Identity Verification
**Rationale:** Independent of other integrations (runs on Celo, not Base). Can be parallelized with Phase 6 if bandwidth allows, or sequenced here. Contract must be deployed and configId derived BEFORE building the frontend QR component.
**Delivers:** Self verifier contract deployed on Celo Alfajores, `lib/chain/self.ts`, SelfQrCode component (dynamic import, ssr: false), `/api/chain/self/verify` endpoint, "Verified Human Operator" badge on agent profiles.
**Addresses:** ZK operator verification (P1), Self Protocol bounty
**Avoids:** Self Protocol config mismatch pitfall (contract first, frontend second)

### Phase 8: Autonomous Agent Decision Loop
**Rationale:** The crown jewel demo feature and the most complex integration. Should be last because it exercises all prior phases end-to-end (ERC-8004 identity, x402 payments, Filecoin log storage, on-chain transactions). Building it earlier introduces cascade risk.
**Delivers:** Agent decision loop (discover bounty → plan → execute service → pay via x402 → verify → log to agent_log.json → upload to Filecoin), visible on-chain transaction trace on BaseScan, agent profile execution history.
**Addresses:** Autonomous agent loop (P1), Protocol Labs "Agents With Receipts" bounty
**Flag:** This phase is the highest complexity and most likely to reveal integration issues in preceding phases. Budget extra time.

### Phase Ordering Rationale

- Phases 1-3 are strictly ordered by dependency: wallet connection unlocks on-chain writes; Filecoin must precede ERC-8004 (agentURI must be immutable); ERC-8004 is the identity foundation everything else references.
- Phase 4 (Clanker) and Phase 5 (x402) could theoretically be swapped, but the rate-limit risk in Phase 4 makes early deployment preferable.
- Phases 6-7 have no dependency on each other and could be parallelized by different team members.
- Phase 8 is intentionally last because it validates all preceding phases work together end-to-end.
- ENS display (Phase 1) is a pure UI enhancement that runs in parallel throughout — embed it as part of the foundation rather than as a standalone phase.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (ERC-8004):** Verify contract addresses on Base mainnet vs Sepolia; confirm agent.json schema is current against EIP spec; double-check there is no viable npm SDK as of build time.
- **Phase 6 (Rare Protocol / NFT):** `@rareprotocol/rare-cli` was NOT found on npm. Must validate actual hackathon bounty requirements before starting. Likely outcome: use OpenZeppelin ERC-721 or Zora for permissionless deployment.
- **Phase 7 (Self Protocol):** Package versions are unpinned in official docs — run `npm show @selfxyz/core version` at build time; ngrok or publicly reachable endpoint needed for Self callback during local development.
- **Phase 8 (Autonomous Loop):** No single authoritative reference covers the full agent decision loop pattern. Requires synthesis of ERC-8004 agent capabilities + x402 fetch + Filecoin logging.

Phases with standard patterns (can likely skip deeper research):
- **Phase 1 (Wallet Infrastructure):** RainbowKit + wagmi setup is extremely well-documented; official docs cover the exact SSR + cookieStorage pattern.
- **Phase 4 (Clanker):** Official Clanker documentation covers deployTokenV4 pattern clearly; main risk is operational (rate limits), not technical.
- **Phase 5 (x402):** Official Coinbase x402 docs and QuickNode guides cover the pattern; main risk is Next.js 16 proxy.ts setup, which is documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core wallet stack (RainbowKit/wagmi/viem) and Clanker/x402 are HIGH confidence with verified versions. ERC-8004 SDK situation is LOW (no viable npm package found — use viem direct). Filecoin Synapse and Self Protocol packages are MEDIUM (names verified, versions unpinned or pre-1.0). |
| Features | MEDIUM | Table stakes and differentiators are well-reasoned from comparable projects (Virtuals, Farcaster, Lens). Specific bounty requirements are assumed from PROJECT.md — verify against actual hackathon brief. |
| Architecture | MEDIUM-HIGH | Core patterns (provider tree, server-side chain adapters, x402 middleware, multi-chain wagmi config) are HIGH confidence from official docs. Rare Protocol adapter architecture is LOW (SuperRare developer docs 404'd). |
| Pitfalls | HIGH | Most critical pitfalls are sourced from official docs and reproducible issue trackers. Clanker rate limit is documented in changelog. Self Protocol config mismatch is from official integration guide. Hydration pitfall is from wagmi official SSR guide. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Rare Protocol / SuperRare minting path:** `@rareprotocol/rare-cli` was not found on npm. Before Phase 6, confirm the actual hackathon bounty requirement: does it need a specific SuperRare contract, or does any ERC-721 on Base qualify? Fallback: OpenZeppelin ERC-721 template + Zora for permissionless Base deployment.
- **Clanker v4 mainnet status:** v4 contracts were "under audit" per late 2025 Clanker X post. Verify live on Base mainnet before demo day. Fallback: deploy on Base Sepolia and demo with testnet.
- **Filecoin Onchain Cloud mainnet availability:** FOC mainnet was expected "early 2026" — confirm explicitly from `@filoz/synapse-sdk` docs or Filecoin Foundation before starting Phase 2. Fallback: Lighthouse or Pinata for IPFS-only storage.
- **Self Protocol package versions:** Official docs do not pin `@selfxyz/core` or `@selfxyz/qrcode` versions. Run `npm show @selfxyz/core version` before Phase 7.
- **Multi-chain wagmi config complexity:** Three chains required (Base/Base Sepolia, Celo/Celo Alfajores, Ethereum mainnet for ENS). Verify RPC endpoints for all chains are available and configured in environment before Phase 1.

## Sources

### Primary (HIGH confidence)
- [RainbowKit Installation + Releases](https://rainbowkit.com/en-US/docs/installation) — wallet connection setup, version 2.2.10 confirmed
- [wagmi SSR Guide](https://wagmi.sh/react/guides/ssr) — hydration setup, cookieStorage pattern
- [wagmi useEnsName docs](https://wagmi.sh/react/api/hooks/useEnsName) — ENS resolution with chainId override
- [ERC-8004 EIP Specification](https://eips.ethereum.org/EIPS/eip-8004) — identity registry NFT architecture, contract ABIs
- [ERC-8004 contracts GitHub](https://github.com/erc-8004/erc-8004-contracts) — verified contract addresses Base Sepolia and mainnet
- [coinbase/x402 GitHub](https://github.com/coinbase/x402) + [@x402/next npm](https://www.npmjs.com/package/@x402/next) — v2.3.0, withX402 vs paymentMiddleware distinction
- [clanker-sdk npm](https://www.npmjs.com/package/clanker-sdk) — v4.2.14, deployTokenV4 method, rate limits
- [Self Protocol Basic Integration docs](https://docs.self.xyz/contract-integration/basic-integration) — contract-first config pattern

### Secondary (MEDIUM confidence)
- [FilOzone/synapse-sdk GitHub](https://github.com/FilOzone/synapse-sdk) — v0.40.0, context-based storage API post-v0.24 breaking change
- [Self Protocol docs](https://docs.self.xyz) + [Celo docs: Build with Self](https://docs.celo.org/build-on-celo/build-with-self) — Celo chain requirement, package names
- [Clanker documentation](https://clanker.gitbook.io/clanker-documentation/) — deployment pattern, API key requirement
- [x402 with Next.js 16 — proxy.ts pattern](https://dev.to/shahbaz17/using-x402-next-with-nextjs-16-1me1) — middleware file rename
- [ERC-8004 DEV community integration guide](https://dev.to/hammertoe/making-services-discoverable-with-erc-8004-trustless-agent-registration-with-filecoin-pin-1al3) — Filecoin + ERC-8004 combined pattern
- [Clawtasks bounty marketplace](https://juliangoldie.com/clawtasks-agent-to-agent-bounty-marketplace-usdc-on-base/) — USDC escrow bounty pattern

### Tertiary (LOW confidence — validate before building)
- SuperRare developer docs — 404 on specific pages; pattern inferred from ERC-721 standard + search results
- `@rareprotocol/rare-cli` — NOT found on npm; mentioned in PROJECT.md but unverifiable; needs direct hackathon brief validation
- Clanker v4 mainnet availability — "under audit" per late 2025 post; needs explicit verification

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
