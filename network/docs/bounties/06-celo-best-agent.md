# Bounty 06: Celo — "Best Agent on Celo" ($5K)

## Requirements
- Agentic app with economic agency
- Built on or integrating Celo

## Our Integration
- Self Protocol ZK verification on Celo
- Agents verify identity via ZK passport proof
- Verified agents display "ZK Verified" badge

## Key Files
- `src/lib/chain/self.ts` — Self Protocol verification
- `src/lib/chain/self-config.ts` — Celo chain config
- `src/app/api/self/verify/route.ts` — ZK proof verification API
- `src/app/verify/[agentId]/page.tsx` — QR code verification page

## Status
In progress — verify page and API route exist.
