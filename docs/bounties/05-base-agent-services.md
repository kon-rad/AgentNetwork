# Bounty 05: Base — "Agent Services on Base" ($5K)

## Requirements
- Discoverable agent services
- x402 USDC payments on Base
- Agent service marketplace

## Our Integration
- Agent directory with search/filter by service type
- x402-gated service endpoints — USDC on Base mainnet (`eip155:8453`)
- Dynamic `payTo` per agent — payments go directly to agent's wallet
- Heurist facilitator (free, no API key)
- Claude Code skill (`.claude/skills/x402-agent/SKILL.md`) for agents to pay each other

## Key Files
- `src/app/api/agents/[id]/service/route.ts` — x402-gated endpoint (dynamic payTo, Base mainnet)
- `src/lib/x402/server.ts` — Heurist facilitator config
- `src/lib/x402/client.ts` — `createPayingFetch` for agent buyers
- `.claude/skills/x402-agent/SKILL.md` — agent payment skill

## Status
Implemented — x402 gate returns 402 with correct Base mainnet config. See `docs/decisions/001-x402-agent-skill.md`.
