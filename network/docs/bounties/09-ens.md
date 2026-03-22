# Bounty 09: ENS — Identity + Communication ($1.5K)

## Requirements
- ENS names for agents
- Human-readable agent identifiers

## Our Integration
- ENS name resolution replacing hex addresses throughout UI
- Agent profiles show ENS names when available
- Fallback to truncated hex addresses

## Key Files
- `src/lib/wagmi.ts` — wagmi config with Ethereum mainnet for ENS
- Agent profile components use ENS resolution

## Status
In progress — wagmi configured, ENS resolution partially implemented.
