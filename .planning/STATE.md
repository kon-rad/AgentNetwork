# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Agents are first-class economic actors with verifiable on-chain identities, personal tokens, and a social feed where they post content that can be collected as NFTs.
**Current focus:** Phase 8 — Polish & Demo

## Current Position

Phase: 8 of 8 (Polish & Demo)
Plan: 2 in current phase
Status: In Progress
Last activity: 2026-03-21 — Completed 08-01: Agent action functions and demo scenarios

Progress: [███████████████████░] ~91%

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 4min
- Total execution time: 0.82 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 9min | 3min |
| 02-filecoin-storage | 2 | 14min | 7min |
| 03-erc-8004-identity | 3 | 11min | 4min |
| 04-clanker-tokens | 2 | 6min | 3min |
| 05-x402-payments | 2 | 5min | 2.5min |
| 06-nft-minting | 2 | 5min | 2.5min |
| 07-self-protocol-zk | 2 | 6min | 3min |

**Recent Trend:**
- Last 5 plans: 3min, 2min, 3min, 3min
- Trend: Normal

*Updated after each plan completion*
| Phase 04 P01 | 4min | 2 tasks | 3 files |
| Phase 04 P02 | 2min | 2 tasks | 2 files |
| Phase 05 P01 | 3min | 2 tasks | 6 files |
| Phase 05 P02 | 2min | 2 tasks | 2 files |
| Phase 06 P01 | 3min | 2 tasks | 4 files |
| Phase 06 P02 | 2min | 2 tasks | 4 files |
| Phase 07 P01 | 3min | 2 tasks | 4 files |
| Phase 07 P02 | 3min | 2 tasks | 6 files |
| Phase 08 P01 | 2min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Use wagmi v2 + RainbowKit 2.2.10 — do NOT upgrade to wagmi v3 (incompatible with RainbowKit 2.x)
- [Init]: Use proxy.ts (not middleware.ts) for x402 in Next.js 16
- [Init]: Deploy all Clanker tokens in one session on day 1 — rate limit is 1 token per wallet per 24h
- [Init]: Register Self Protocol verifier contract on Celo before building frontend QR component
- [01-01]: wagmi must be pinned to v2.x — pnpm resolves v3 by default, breaking RainbowKit 2.x peer deps
- [01-01]: Import RainbowKit styles.css in providers.tsx (client component), NOT globals.css — Tailwind 4 CSS conflict
- [01-01]: No Turbopack polyfill config needed — viem/wagmi/RainbowKit are ESM-native, Turbopack handles natively
- [01-01]: layout.tsx must be async with await cookies() for Next.js 16 (synchronous cookies() throws)
- [01-02]: Always pass chainId: mainnet.id to useEnsName — ENS registry lives on Ethereum mainnet, not Base; without this all lookups return null when wallet is on Base
- [01-02]: Post and Bounty types only expose joined display_name fields (no wallet_address) — ENS on feed/bounty cards deferred until types are extended
- [01-03]: badge-{service_type} CSS classes used instead of inline Tailwind color maps — more maintainable and consistent with globals.css design system
- [01-03]: Bounty status colors use semantic cyberpunk palette: open=cyan, claimed/in_progress=gold, completed=neon-green
- [01-03]: SkeletonGrid handles responsive layout per card type; agent-filter.tsx zinc styles deferred (out of plan scope)
- [02-01]: Import getChain from @filoz/synapse-sdk (not @filoz/synapse-core/chains) — synapse-core not hoisted to top-level node_modules in pnpm
- [02-01]: SynapseFromClientOptions requires source: string | null — set to null to disable referral tracking
- [02-01]: synapse.storage.download({ pieceCid }) not synapse.download() — download method lives on StorageManager
- [02-01]: Use onPiecesConfirmed as upload-done signal — onStored fires before PDP proof confirmation; retrieval not guaranteed until onPiecesConfirmed
- [02-02]: Return 502 (not 500) for Filecoin SDK failures — distinguishes upstream service failure from internal errors
- [02-02]: crypto.randomUUID() used for DB record IDs — native to Node.js 16+, no uuid package import needed
- [02-02]: Agent filecoin list returns empty array (not 404) for agents with no uploads — empty is valid state
- [02-02]: Cache-Control: public, max-age=31536000, immutable on download route — Filecoin content is content-addressed and immutable by CID
- [03-01]: Use decodeEventLog with iteration (not log index position) to parse Registered event from receipts
- [03-01]: Separate registeredEventAbi const for event parsing -- keeps ABI fragments minimal and purpose-specific
- [03-01]: Agent card endpoint uses relative path /api/agents/{id} -- actual domain depends on deployment
- [03-02]: Import uploadToFilecoin directly (server-side) instead of HTTP fetch to /api/chain/upload -- avoids unnecessary round-trip
- [03-02]: Registration idempotency uses erc8004_token_id presence check -- returns 200 with existing info instead of re-registering
- [03-02]: Feedback value validated as integer 1-10 with defaults for tag1 (quality) and tag2 (agent.service_type or general)
- [03-03]: Use local useState to track registration result instead of refetching agent data
- [03-03]: ReputationCard returns null when tokenId is null -- no empty card for unregistered agents
- [04-01]: Import Clanker from clanker-sdk/v4 (not top-level) -- Clanker class lives in v4 subpath export
- [04-01]: SDK deploy() returns { txHash, waitForTransaction } -- must await waitForTransaction for token address
- [04-01]: Pool uses POOL_POSITIONS.Standard from clanker-sdk presets -- avoids manual tick configuration
- [04-01]: Vault lockupDuration in seconds (not durationInDays) -- SDK v4 API changed from research
- [04-02]: TokenInfo returns null when both tokenSymbol and tokenAddress are null -- no empty card for agents without token config
- [04-02]: Buy button uses <a> tag (not button) when token is deployed -- direct Uniswap navigation without JS handler
- [04-02]: Stats row token symbol links to BaseScan only when token_address exists -- avoids dead links for undeployed tokens
- [05-01]: withX402 handler takes single NextRequest arg -- extract agent ID from URL path segments
- [05-01]: Single operator wallet (AGENT_PAYMENT_ADDRESS) for x402 payTo -- per-agent dynamic payTo unverified
- [05-01]: USDC transfer uses simulateContract before writeContract -- validates transfer will succeed before spending gas
- [05-02]: pending_payment intermediate status set before USDC transfer attempt -- allows UI to show pending state
- [05-02]: Zero-reward bounties complete without transfer -- supports non-monetary bounties
- [05-02]: Status badge updated for pending_payment and payment_failed states with cyberpunk color coding
- [06-01]: SDK deploy.erc721 and mint.mintTo use object params ({ name, symbol } not positional) -- research assumed positional args
- [06-01]: Type assertion (as any) for viem clients passed to createRareClient -- cross-version nominal type mismatch
- [06-01]: Mint route auto-deploys collection if agent has no nft_collection_address -- no separate deploy step required
- [06-02]: Added nft_only query param to posts API rather than client-side filtering -- server-side is more efficient
- [06-02]: Duplicated timeAgo helper in nft-portfolio.tsx -- avoids coupling to post-card internals
- [07-01]: Per-call SelfBackendVerifier instantiation (not singleton) -- endpoint URL from env var may differ per environment
- [07-01]: Parameters typed as any due to CJS/ESM type mismatch in @selfxyz/core -- SDK validates shapes internally
- [07-01]: All responses HTTP 200 with status in JSON body -- Self Protocol convention, not HTTP status codes
- [07-02]: Extracted shared Self config to self-config.ts (no server-only) to allow client component import without breaking server module
- [07-02]: SelfAppBuilder config cast to any -- Partial<SelfApp> type requires all fields but builder fills defaults
- [07-02]: Server page + client wrapper pattern for verification page: page.tsx loads agent from DB, verify-client.tsx handles QR and redirect
- [08-01]: Used real mintPostNFT signature (collectionAddress, toAddress, tokenUri) instead of plan's simplified (agentId, postId) -- matched actual chain/nft.ts exports
- [08-01]: Auto-deploy NFT collection inside mintPostNFTAction when agent has no nft_collection_address -- mirrors existing mint-nft route pattern
- [08-01]: Payment failure in completeBountyAction logs error but still completes bounty -- payment is best-effort for demo

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: FOC mainnet confirmed live (Jan 31, 2026). Wallet must be funded with tFIL (gas) and tUSDFC (storage) before uploads will work
- [Phase 3]: Verify ERC-8004 contract addresses on Base mainnet vs Sepolia; no viable npm SDK (use viem direct calls)
- [Phase 6]: RESOLVED — @rareprotocol/rare-cli@0.3.0 installed and working; SDK uses object params for deploy/mint
- [Phase 7]: RESOLVED — @selfxyz/core@1.2.0-beta.1 and @selfxyz/qrcode@1.0.22 installed; CJS/ESM type mismatch handled via any casts
- [Phase 8]: Highest complexity phase — budget extra time; likely to surface integration issues from prior phases

## Session Continuity

Last session: 2026-03-21
Stopped at: Completed 08-01-PLAN.md — Agent action functions and demo scenarios
Resume file: None
