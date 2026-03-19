# Stack Research

**Domain:** AI agent social marketplace with on-chain identity, tokens, NFTs, and payments on Base
**Researched:** 2026-03-20
**Confidence:** MEDIUM (core Web3 stack HIGH; niche protocol SDKs LOW-MEDIUM due to rapid evolution)

---

## Context: What We're Adding

The existing app is Next.js 16 + React 19 + TypeScript 5 + SQLite + Tailwind CSS 4 + Zustand 5.
All additions below integrate *into* this existing codebase. Nothing replaces what's there.

---

## Recommended Stack

### Wallet Connection Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@rainbow-me/rainbowkit` | 2.2.10 | Wallet connection UI | Most polished wallet picker; supports MetaMask, WalletConnect, Coinbase Wallet, Trust, Ronin out of the box; WalletConnect Cloud integration built in; only option that meets the explicit hackathon requirement for those three wallets |
| `wagmi` | ^2.x (NOT v3) | React hooks for Ethereum | v3 exists but RainbowKit 2.2.10 is pinned to wagmi ^2.17+; do NOT upgrade to wagmi v3 until RainbowKit releases v3 support (tracked in rainbowkit/discussions#2575) |
| `viem` | 2.47.4 | Low-level Ethereum TypeScript client | RainbowKit's required peer dep; used directly for contract calls, ENS resolution, and tx construction |
| `@tanstack/react-query` | ^5.91 | Async state for wagmi hooks | Required wagmi v2 peer dep; v5 is stable and current |

**Confidence:** HIGH — versions verified against official RainbowKit releases page and npm.

**Critical constraint:** RainbowKit 2.x requires wagmi 2.x. Do NOT install wagmi 3.x — as of March 2026, RainbowKit has not shipped wagmi v3 support and the combination will break.

**WalletConnect Cloud:** A free `projectId` from https://cloud.walletconnect.com is mandatory; every dApp using WalletConnect must have one.

---

### On-Chain Identity — ERC-8004

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Direct viem contract calls | via viem 2.x | Register agents in IdentityRegistry | No mature npm SDK exists; `@agentic-trust/8004-ext-sdk` shows anomalous version metadata (published "14 years ago") and is not trustworthy; `create-8004-agent` is a CLI scaffolder, not a library |
| `erc-8004-contracts` ABIs | from GitHub | Contract ABI source | Official ABIs at `github.com/erc-8004/erc-8004-contracts` in `/abis` directory |

**Confidence:** MEDIUM — contract addresses verified from official GitHub repo.

**Contract addresses (verified):**
- Base Sepolia IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Base Sepolia ReputationRegistry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- Base Mainnet IdentityRegistry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Base Mainnet ReputationRegistry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

**Implementation pattern:** Pull ABIs from erc-8004-contracts repo, use `viem`'s `writeContract` + `readContract` directly. Agent metadata is IPFS-pinned before the on-chain call; NFT minting on IdentityRegistry serves as agent registration.

---

### Token Launch — Clanker

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `clanker-sdk` | 4.2.14 | Deploy ERC-20 + Uniswap V4 pool in one tx | Official SDK from Clanker team; v4 supports Base Sepolia and Base mainnet; pairs viem wallet client for signing |

**Confidence:** HIGH — version and npm existence verified via npm registry.

**Key notes:**
- Requires a Clanker API key (`x-api-key` header) for authenticated deployments
- Uses `deployTokenV4()` method for current v4 contracts (v4 contracts were under audit as of late 2025 — verify mainnet readiness before demo)
- Peer dep: `viem` (already in stack)

---

### Payments — x402

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@x402/next` | 2.3.0 | Next.js middleware for HTTP 402 paywalls | Official Coinbase package; wraps API routes with payment requirements; USDC on Base mainnet; fee-free settlement via Coinbase facilitator |
| `@x402/fetch` | latest | Client-side fetch with payment headers | Used by agent code when calling paid endpoints |

**Confidence:** HIGH — verified at npmjs.com, coinbase/x402 GitHub confirmed as official Coinbase repo.

**Key notes:**
- The legacy `x402-next` (without `@x402/` scope) is a community fork; use `@x402/next` from Coinbase
- Coinbase CDP API keys needed for the hosted facilitator (free tier available)
- x402 Foundation (Coinbase + Cloudflare) announced September 2025; protocol is now an open standard
- Payment flow: Server routes wrapped with `x402ResourceServer`; agents pay using `@x402/fetch`

---

### ENS Resolution

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `wagmi` (built-in) | ^2.x | `useEnsName`, `useEnsAddress` hooks | ENS resolution is a first-class wagmi feature; no additional package needed; `useEnsName` does reverse lookup (address → name), `useEnsAddress` does forward lookup |
| `viem` (built-in) | 2.x | `getEnsName`, `getEnsAddress`, normalize | viem's ENS actions work without wagmi if needed in server context |

**Confidence:** HIGH — verified in wagmi and ENS official docs.

**Key notes:**
- ENS resolution must target Ethereum mainnet (chain ID 1), not Base — configure a separate mainnet transport in wagmi config
- As of September 2025, wagmi/viem are the only libraries supporting L2 Primary Names
- Use `normalize()` from viem before passing ENS names to avoid encoding issues

---

### NFT Minting — Rare Protocol / SuperRare Partner Track

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `viem` contract writes | via viem 2.x | Mint ERC-721 NFTs on Base | No `@rareprotocol/rare-cli` npm package was found in research; SuperRare's developer tooling is via Transient Labs' ERC721TL contract |
| Transient Labs ERC721TL | deployed contract | ERC-721 creator contract shown on SuperRare | SuperRare DAO invested in Transient Labs in 2025 to replace legacy minting; ERC721TL tokens display on SuperRare marketplace |

**Confidence:** LOW — "Rare Protocol" as a named npm SDK was not found. The PROJECT.md reference to `@rareprotocol/rare-cli` could not be verified. Recommend validating actual hackathon bounty requirements directly.

**Recommended approach for hackathon:**
1. Deploy a minimal ERC721 contract on Base Sepolia using an OpenZeppelin template OR use an existing Transient Labs factory contract address
2. Mint via `viem` `writeContract`
3. List/display on SuperRare if artist invite obtained (SuperRare requires curator invite for mainstream minting)
4. Alternative: Use Crossmint or Zora for permissionless ERC-721 deployment on Base if SuperRare invite is not available

**Flag:** Verify with the actual Synthesis hackathon brief whether SuperRare requires specific contract addresses or if any ERC-721 on Base qualifies for the bounty.

---

### Decentralized Storage — Filecoin Onchain Cloud

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@filoz/synapse-sdk` | 0.40.0 | Upload and retrieve files from Filecoin Onchain Cloud | Official FilOzone SDK; v0.40.0 released March 17, 2026; covers storage upload, retrieval, and payment in one SDK |

**Confidence:** MEDIUM — version verified from GitHub releases; mainnet readiness NOT explicitly confirmed in docs.

**Key notes:**
- Three sub-packages exist: `@filoz/synapse-sdk` (main), `@filoz/synapse-core`, `@filoz/synapse-react`
- FOC mainnet announced November 2025; Filecoin Foundation confirmed expansion in December 2025; v0.40.0 suggests active development but pre-1.0 API stability
- Used for: agent content storage, agent execution logs (`agent_log.json`), agent.json manifests
- Payment is on-chain via FIL or USDFC tokens — ensure wallet has funds on Filecoin network
- v0.24.0 introduced breaking changes (context-based storage API) — follow current docs, not old tutorials

---

### ZK Identity Verification — Self Protocol

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@selfxyz/qrcode` | latest | QR code component for Self app scanning | Official Self package; handles display, LED state, and verification flow in one React component |
| `@selfxyz/core` | latest | `SelfAppBuilder`, `getUniversalLink` utilities | Core SDK for configuring the verification scope and deep links |
| `ethers` | ^6.x | Ethereum address utilities (Self SDK peer dep) | Self docs explicitly list ethers as a requirement alongside the above packages |

**Confidence:** MEDIUM — package names verified from official Self docs and GitHub; versions not pinned in official docs.

**Key notes:**
- Self Protocol attests on the **Celo blockchain** (not Base) — requires a Celo RPC in wagmi config
- Proof verifier contract must be deployed on Celo; Self provides a shared verifier
- Google Cloud and Celo testnet faucet both integrated Self in 2025 — project is active and credible
- The `SelfQRcodeWrapper` component manages the full verification UX; backend must expose an endpoint for proof submission
- For hackathon: use Self's shared verifier contract on Celo Alfajores (testnet) for development

---

### IPFS/Metadata Pinning (Required by ERC-8004 and NFTs)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@pinata/sdk` OR Pinata HTTP API | latest | Pin JSON metadata and images to IPFS | ERC-8004 registration requires metadata at an IPFS URI; create-8004-agent uses Pinata; free tier covers hackathon needs |

**Confidence:** MEDIUM — Pinata is standard and widely used; confirmed in create-8004-agent reference implementation.

---

## Full Installation Commands

```bash
# Wallet connection (RainbowKit + wagmi v2 + viem v2 + TanStack Query v5)
pnpm add @rainbow-me/rainbowkit wagmi viem@2 @tanstack/react-query

# Token launch
pnpm add clanker-sdk

# x402 payments
pnpm add @x402/next @x402/fetch

# Filecoin storage
pnpm add @filoz/synapse-sdk

# Self Protocol ZK identity
pnpm add @selfxyz/qrcode @selfxyz/core ethers

# IPFS pinning for metadata
pnpm add @pinata/sdk
```

Note: ENS resolution and ERC-8004 contract calls use wagmi/viem directly — no additional packages.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| RainbowKit 2.x | Dynamic.xyz, Privy | If you need social login (email/SMS) alongside wallet — not needed for this project |
| RainbowKit 2.x | ConnectKit | If you want a lighter bundle — but RainbowKit is already the standard on Base ecosystem |
| wagmi v2 | wagmi v3 | Switch when RainbowKit ships v3 support — check rainbowkit/rainbowkit#2575 |
| viem direct contract calls for ERC-8004 | `@agentic-trust/8004-ext-sdk` | Only if that package is updated and verified — current npm metadata is suspicious |
| `@filoz/synapse-sdk` | Lighthouse, Pinata (for IPFS-only) | Lighthouse if you need pure IPFS with simpler API; Pinata for metadata-only pinning (not full content storage) |
| Self Protocol on Celo | Worldcoin ID, Anon Aadhar | Only if Celo integration is too complex — Self is specifically required for the hackathon bounty |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `wagmi` v3 | RainbowKit 2.x is incompatible with wagmi v3 as of March 2026 | wagmi ^2.x |
| `web3.js` | Deprecated in favor of viem/ethers; heavier bundle; poor TypeScript support | viem |
| `ethers.js` v5 | v5 is end-of-life; v6 is current but viem supersedes it for this stack | viem |
| `x402-next` (unscoped) | Community fork; not maintained by Coinbase; API differs from official `@x402/next` | `@x402/next` |
| `@agentic-trust/8004-ext-sdk` | npm metadata shows suspicious "14 years ago" publish date — likely a test package or corrupted registry entry | viem direct contract calls with ERC-8004 ABIs |
| MetaMask SDK directly | RainbowKit already abstracts MetaMask plus 15+ other wallets — adding the direct SDK creates conflicts | RainbowKit |
| Alchemy NFT API for minting | Read-only API, cannot mint on your behalf without custody | viem writeContract to ERC-721 contract |

---

## Version Compatibility Matrix

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `@rainbow-me/rainbowkit@2.2.10` | `wagmi@^2.17+`, `viem@2.x`, `@tanstack/react-query@^5` | Do NOT use with wagmi v3 |
| `wagmi@2.x` | `viem@2.x` | viem v1 will NOT work with wagmi v2 |
| `clanker-sdk@4.x` | `viem@2.x` | clanker-sdk uses viem wallet client for signing |
| `@x402/next@2.3.0` | Next.js 14-16, Node.js 18+ | Uses Next.js middleware API; works with App Router |
| `@filoz/synapse-sdk@0.40.0` | Node.js 18+, browser via bundler | Breaking changes introduced at v0.24.0; do not follow pre-0.24 tutorials |
| `@selfxyz/core` + `@selfxyz/qrcode` | React 18+, ethers v6 | Verify ethers version; Self docs list ethers as explicit peer dep |
| `Next.js@16` (existing) | React 19, TypeScript 5 | All additions above are compatible with existing stack |

---

## Stack Patterns by Variant

**For all wallet/chain interactions (client-side):**
- Wrap app in `<WagmiProvider>` → `<QueryClientProvider>` → `<RainbowKitProvider>` in a `'use client'` providers component
- Import providers component in `src/app/layout.tsx`

**For ERC-8004 registration (server-side / agent script):**
- Use viem's `createWalletClient` with a private key (agent wallet) — no browser wallet needed
- Pull ABI from erc-8004-contracts repo, call `writeContract` on IdentityRegistry

**For x402 payments on API routes:**
- Wrap route handler with `x402ResourceServer` from `@x402/next`
- Agent clients use `@x402/fetch` with a wallet signer to auto-pay

**For Self Protocol verification:**
- Frontend: render `<SelfQRcodeWrapper>` with verification config; user scans with Self app
- Backend: expose `/api/verify-identity` endpoint that receives the ZK proof and calls the Celo verifier contract
- This requires a separate Celo-configured viem client (chain: celoAlfajores for testnet)

**For multi-chain (Base + Celo + Ethereum):**
- Configure three chains in wagmi: `base`, `baseSepolia`, `celo`, `celoAlfajores`, `mainnet`
- ENS resolution routes to `mainnet` transport
- Self Protocol routes to `celo`/`celoAlfajores`
- All other operations route to `base`/`baseSepolia`

---

## Open Research Items (Verify Before Building)

1. **Rare Protocol / SuperRare NFT minting:** `@rareprotocol/rare-cli` was NOT found on npm. Verify actual hackathon bounty requirements at the Synthesis brief. May be sufficient to deploy any ERC-721 on Base and list on SuperRare after curator approval, OR the bounty may just require ERC-721 on a SuperRare-compatible contract.

2. **Clanker v4 mainnet status:** v4 contracts were listed as "under audit" in late 2025 (per Clanker's X post). Verify whether v4 is live on Base mainnet before demo day.

3. **`@filoz/synapse-sdk` mainnet:** FOC mainnet was expected "early 2026" per Filecoin blog (November 2025). SDK v0.40.0 is current but mainnet readiness needs explicit confirmation from docs.

4. **Self Protocol `@selfxyz` package versions:** Official docs do not pin versions. Run `npm show @selfxyz/core version` before installing to ensure latest stable.

---

## Sources

- [RainbowKit Installation docs](https://rainbowkit.com/en-US/docs/installation) — package list, setup pattern — HIGH confidence
- [RainbowKit Releases (GitHub)](https://github.com/rainbow-me/rainbowkit/releases) — version 2.2.10 confirmed — HIGH confidence
- [RainbowKit wagmi v3 support discussion](https://github.com/rainbow-me/rainbowkit/discussions/2575) — wagmi v3 incompatibility confirmed — HIGH confidence
- [wagmi Getting Started](https://wagmi.sh/react/getting-started) — peer deps — HIGH confidence
- [viem npm](https://www.npmjs.com/package/viem) — version 2.47.4 confirmed — HIGH confidence
- [@tanstack/react-query npm](https://www.npmjs.com/package/@tanstack/react-query) — v5.91.0 confirmed — HIGH confidence
- [ERC-8004 contracts GitHub](https://github.com/erc-8004/erc-8004-contracts) — contract addresses confirmed — HIGH confidence
- [clanker-sdk npm](https://www.npmjs.com/package/clanker-sdk) — v4.2.14 confirmed — HIGH confidence
- [Clanker documentation](https://clanker.gitbook.io/clanker-documentation/) — deployment pattern — HIGH confidence
- [@x402/next npm](https://www.npmjs.com/package/@x402/next) — v2.3.0, Coinbase official — HIGH confidence
- [coinbase/x402 GitHub](https://github.com/coinbase/x402) — package list confirmed — HIGH confidence
- [wagmi ENS hooks docs](https://wagmi.sh/react/api/hooks/useEnsAddress) — ENS resolution pattern — HIGH confidence
- [ENS Address Lookup docs](https://docs.ens.domains/web/resolution/) — resolution pattern — HIGH confidence
- [FilOzone/synapse-sdk GitHub](https://github.com/FilOzone/synapse-sdk) — v0.40.0 confirmed — MEDIUM confidence
- [Filecoin Onchain Cloud blog](https://filecoin.io/blog/posts/introducing-filecoin-onchain-cloud/) — mainnet launch Nov 2025 — MEDIUM confidence
- [Self Protocol docs](https://docs.self.xyz/use-self/quickstart) — package names @selfxyz/qrcode, @selfxyz/core — MEDIUM confidence
- [Self Protocol GitHub](https://github.com/selfxyz/self) — confirmed active project — MEDIUM confidence
- [Celo docs: Build with Self](https://docs.celo.org/build-on-celo/build-with-self) — Celo chain requirement confirmed — MEDIUM confidence
- [create-8004-agent GitHub README](https://github.com/Eversmile12/create-8004-agent) — ERC-8004 registration pattern — MEDIUM confidence

---

*Stack research for: AI agent social marketplace on Base*
*Researched: 2026-03-20*
