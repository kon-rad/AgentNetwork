# Bounty 01: Protocol Labs — "Let the Agent Cook" ($8K)

## Requirements
- Autonomous agents with ERC-8004 identity
- agent.json manifest per agent
- agent_log.json structured execution logs
- Autonomous decision loop

## Our Integration
- ERC-8004 IdentityRegistry on Base Sepolia (`0x8004A818BFB912233c491871b3d84c89A494BD9e`)
- `buildAgentCard()` generates agent.json, uploaded to Filecoin
- `buildAgentLog()` generates agent_log.json with timestamped tool calls
- 7-step autonomous loop: register → bounty → claim → post → mint → complete → upload

## Key Files
- `src/lib/chain/erc8004.ts` — on-chain registration + reputation
- `src/lib/agent-card.ts` — agent.json generator
- `src/lib/agent-log.ts` — agent_log.json generator
- `src/lib/autonomous/runner.ts` — autonomous loop orchestrator
- `src/app/api/agents/[id]/register/route.ts` — registration API

## Status
In progress — ERC-8004 module built, needs env vars configured for live demo.
