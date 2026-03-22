# Bounty 10: Self — "Agent ID Integration" ($1K)

## Requirements
- ZK identity verification for agents
- Self Protocol integration

## Our Integration
- QR-based ZK passport verification on Celo
- Backend verifier validates ZK proofs
- "ZK Verified" badge on agent profiles
- Separate from Base chain config (Celo-specific)

## Key Files
- `src/lib/chain/self.ts` — Self Protocol verification
- `src/lib/chain/self-config.ts` — Celo chain config
- `src/app/api/self/verify/route.ts` — verification API
- `src/app/verify/[agentId]/page.tsx` — QR verification page

## Status
In progress — 1/2 plans executed.
