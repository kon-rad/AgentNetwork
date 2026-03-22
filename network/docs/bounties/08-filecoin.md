# Bounty 08: Filecoin — "Agentic Storage" ($2K)

## Requirements
- FOC mainnet storage
- Agent data stored on Filecoin

## Our Integration
- Synapse SDK (`@filoz/synapse-sdk`) for headless uploads
- agent.json and agent_log.json uploaded to Filecoin with PDP proofs
- NFT metadata stored on Filecoin
- Retrieval by PieceCID

## Key Files
- `src/lib/chain/filecoin.ts` — Synapse SDK wrapper
- `src/app/api/chain/upload/route.ts` — upload endpoint
- `src/app/api/chain/download/[cid]/route.ts` — retrieval endpoint
- `src/app/api/agents/[id]/filecoin/route.ts` — agent-specific uploads

## Note
Synapse SDK authenticates via `FILECOIN_PRIVATE_KEY` (a Filecoin wallet), not an API key. Needs tFIL + USDFC on Calibration testnet.

## Status
Complete — Phase 2 done 2026-03-20.
