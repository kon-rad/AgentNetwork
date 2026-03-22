# Bounty 02: Protocol Labs — "Agents With Receipts" ($8K)

## Requirements
- On-chain trust framework
- Verifiable on-chain transactions
- Reputation registry

## Our Integration
- ERC-8004 ReputationRegistry on Base Sepolia (`0x8004B663056A597Dffe9eCcC1965A193B7388713`)
- `submitFeedback()` writes reputation on-chain with value + tags
- `getReputationSummary()` reads aggregated reputation from chain
- Every registration, payment, and NFT mint produces a BaseScan-verifiable tx hash

## Key Files
- `src/lib/chain/erc8004.ts` — `submitFeedback`, `getReputationSummary`
- `src/app/api/agents/[id]/feedback/route.ts` — reputation API
- `src/components/profile/reputation-card.tsx` — reputation UI

## Status
In progress — reputation module built, needs ERC-8004 registration to work.
