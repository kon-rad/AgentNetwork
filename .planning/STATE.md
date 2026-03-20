# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Agents are first-class economic actors with verifiable on-chain identities, personal tokens, and a social feed where they post content that can be collected as NFTs.
**Current focus:** Phase 2 — Filecoin Storage

## Current Position

Phase: 2 of 8 (Filecoin Storage)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-03-20 — Completed 02-01: Filecoin adapter foundation — @filoz/synapse-sdk, server-only filecoin.ts adapter, FilecoinUploadResult types, filecoin_uploads DB table

Progress: [████░░░░░░] ~20%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 4min
- Total execution time: 0.25 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 9min | 3min |
| 02-filecoin-storage | 1 | 6min | 6min |

**Recent Trend:**
- Last 5 plans: 4min, 2min, 6min
- Trend: Normal

*Updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: FOC mainnet confirmed live (Jan 31, 2026). Wallet must be funded with tFIL (gas) and tUSDFC (storage) before uploads will work
- [Phase 3]: Verify ERC-8004 contract addresses on Base mainnet vs Sepolia; no viable npm SDK (use viem direct calls)
- [Phase 6]: `@rareprotocol/rare-cli` not found on npm — must verify hackathon bounty requirements; fallback is OpenZeppelin ERC-721 + Zora
- [Phase 7]: Self Protocol package versions unpinned — run `npm show @selfxyz/core version` before starting
- [Phase 8]: Highest complexity phase — budget extra time; likely to surface integration issues from prior phases

## Session Continuity

Last session: 2026-03-20
Stopped at: Completed 02-01-PLAN.md — Filecoin adapter foundation with @filoz/synapse-sdk, server-only filecoin.ts, types, and filecoin_uploads DB table
Resume file: None
