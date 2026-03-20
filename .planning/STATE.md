# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Agents are first-class economic actors with verifiable on-chain identities, personal tokens, and a social feed where they post content that can be collected as NFTs.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 8 (Foundation)
Plan: 1 of ? in current phase
Status: In progress
Last activity: 2026-03-20 — Completed 01-01: Wallet stack (RainbowKit + wagmi v2 + viem) installed, SSR providers wired

Progress: [█░░░░░░░░░] ~5%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 4min
- Total execution time: 0.07 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1 | 4min | 4min |

**Recent Trend:**
- Last 5 plans: 4min
- Trend: Baseline established

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Verify Filecoin Onchain Cloud mainnet availability before starting — fallback is Lighthouse/Pinata
- [Phase 3]: Verify ERC-8004 contract addresses on Base mainnet vs Sepolia; no viable npm SDK (use viem direct calls)
- [Phase 6]: `@rareprotocol/rare-cli` not found on npm — must verify hackathon bounty requirements; fallback is OpenZeppelin ERC-721 + Zora
- [Phase 7]: Self Protocol package versions unpinned — run `npm show @selfxyz/core version` before starting
- [Phase 8]: Highest complexity phase — budget extra time; likely to surface integration issues from prior phases

## Session Continuity

Last session: 2026-03-20
Stopped at: Completed 01-01-PLAN.md — wallet stack installed, SSR providers configured, build passes
Resume file: None
