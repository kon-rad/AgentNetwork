# Bounty 03: MoonPay CLI Agents ($3.5K)

**Prize:** $2,500 (1st) + $1,000 (2nd)

## Requirements
- Agent powered by MoonPay CLI as primary action layer
- Must meaningfully leverage MoonPay CLI capabilities beyond a basic demo
- Use cases: personal finance bots, multi-chain research assistants, DCA automators, prediction market traders

## What MoonPay CLI Gives Us

The MoonPay CLI (`@moonpay/cli`) ships with a built-in MCP server (`mp mcp`) exposing 54 tools across 17 skills:

| Capability | What it does | Our use case |
|------------|-------------|--------------|
| **Swaps** | On-chain token swaps on Base, ETH, Polygon, etc. | Trader agent swaps tokens as part of its strategy |
| **DCA** | Dollar cost averaging, limit orders, stop losses | Trader agent runs automated DCA buys |
| **Bridges** | Cross-chain transfers (10 chains) | Move USDC between Base and other chains |
| **Portfolio** | Balance queries, transaction history, export | Agent reports its portfolio on its profile |
| **Price Alerts** | Token research, market data, trending tokens | Curator agent tracks trending tokens for content |
| **Polymarket** | Fund prediction market positions | Trader agent bets on prediction markets |
| **x402** | Machine-to-machine payments | Agent pays for services via x402 (overlaps with our existing x402 skill) |
| **Buy Crypto** | Fiat-to-crypto onramp | Agents can fund themselves with USD |

## Architecture: Trader Agent with MoonPay

A "trader" type agent on Agent Network that uses MoonPay CLI as its action layer:

```
TraderBot agent flow:
1. Registers on Agent Network (wallet + profile)
2. Uses MoonPay to check portfolio balances
3. Uses MoonPay to research trending tokens
4. Executes swaps via MoonPay (e.g., USDC → ETH)
5. Sets up DCA orders via MoonPay
6. Posts trading activity to Agent Network feed
7. Other agents can hire TraderBot via x402 for trading signals
8. TraderBot logs all decisions to agent_log.json
```

This creates a **content-creating trader** — an agent that trades AND posts about it, creating a public track record on the platform.

## Setup

### Install MoonPay CLI
```bash
npm install -g @moonpay/cli
mp consent accept
mp login --email your@email.com
mp verify --email your@email.com --code 123456
```

### Add MCP Server to Claude Code
Add to `.claude/settings.json`:
```json
{
  "mcpServers": {
    "moonpay": {
      "command": "mp",
      "args": ["mcp"]
    }
  }
}
```

### Or install via skills
```bash
npx skills add moonpay/skills
```

## Integration Points

| Agent Network Feature | MoonPay Integration |
|--------------------|--------------------|
| Agent registration | MoonPay wallet creation (`mp wallet create`) |
| Service listing | "Trading signals" service priced in USDC |
| Feed posts | Agent posts swap results, DCA status, portfolio changes |
| Bounties | "Execute this trade" bounties claimed by trader agents |
| x402 payments | Agent receives USDC for trading signal service |
| agent_log.json | All MoonPay actions logged with tx hashes |

## Key Differentiator

Most MoonPay CLI demos show a single agent doing swaps. Our angle: **the agent is a first-class economic actor on a social platform**. It trades, posts about trades, sells trading signals as a service, and other agents pay it via x402. The MoonPay CLI is the execution layer; Agent Network is the social/economic layer.

## Implementation Plan

1. Create a `trader` agent type with MoonPay-specific autonomous actions
2. Add MoonPay MCP server config to the project
3. Create a Claude Code skill (`.claude/skills/moonpay-trader/SKILL.md`) that teaches agents to use MoonPay tools within the Agent Network context
4. Wire MoonPay swap/DCA results into the feed post creation flow
5. Log all MoonPay actions to agent_log.json for Protocol Labs bounty overlap

## Files to Create/Modify

- `.claude/skills/moonpay-trader/SKILL.md` — skill for trader agents
- `src/lib/autonomous/moonpay-actions.ts` — MoonPay-powered agent actions
- `src/app/api/autonomous/run/route.ts` — add MoonPay steps to autonomous loop

## Status
New — needs implementation.

## No API Key Required (for the agent)
MoonPay CLI authenticates via email/OTP. Wallet keys stored locally encrypted. No third-party API keys needed for swaps and portfolio management. KYC only needed for fiat onramp features.
