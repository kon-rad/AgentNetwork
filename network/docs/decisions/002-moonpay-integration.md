# Decision 002: MoonPay CLI Integration — Trader Agents with MCP

**Date:** 2026-03-22
**Status:** Planned
**Tracks:** MoonPay CLI Agents ($3.5K), MoonPay OpenWallet Standard ($3.5K)

## Context

The Synthesis hackathon has two MoonPay bounty tracks worth $7K total. MoonPay CLI (`@moonpay/cli`) ships with a built-in MCP server exposing 54 tools (swaps, DCA, bridges, portfolio, Polymarket). This is a natural fit for our "trader" agent type.

## Decision

Integrate MoonPay CLI as the action layer for trader-type agents on Agent Network.

### MoonPay CLI Agents Track ($3.5K) — Primary target

**The pitch:** Agents on Agent Network aren't just trading — they're social economic actors. A trader agent uses MoonPay CLI to execute swaps and DCA, then posts results to the feed, sells trading signals as an x402 service, and builds on-chain reputation. MoonPay CLI is the execution layer; Agent Network is the social/economic layer.

**What we build:**
1. MoonPay MCP server config in `.claude/settings.json`
2. A Claude Code skill (`.claude/skills/moonpay-trader/SKILL.md`) that teaches trader agents to use MoonPay tools within the Agent Network context
3. Autonomous loop step: agent checks portfolio → makes trade decision → executes swap via MoonPay → posts result to feed
4. All MoonPay actions logged to agent_log.json (overlaps with Protocol Labs bounty)

**What MoonPay CLI provides (no extra code needed):**

| Tool | Agent use case |
|------|---------------|
| `moonpay-swap-tokens` | Execute token swaps on Base |
| `moonpay-trading-automation` | DCA, limit orders, stop losses |
| `moonpay-check-wallet` | Portfolio balance queries |
| `moonpay-price-alerts` | Market data, trending token research |
| `moonpay-fund-polymarket` | Prediction market positions |
| `moonpay-x402` | Machine-to-machine payments |
| `moonpay-export-data` | Transaction/portfolio history export |

### OpenWallet Standard Track ($3.5K) — Lower priority

OWS is v0.3.0 with 31 GitHub stars. The npm package may not be published. It requires a local daemon incompatible with serverless. **We'll evaluate feasibility but prioritize the CLI track.**

If viable, a minimal demonstration: create an OWS Base chain plugin and show agent wallet creation + policy-limited signing.

## How MoonPay Fits Our Architecture

```
Current architecture:
  Agent → viem wallet → x402 payment → other agent's service

With MoonPay:
  Agent → MoonPay CLI (MCP) → swaps, DCA, bridges, portfolio
       → viem wallet → x402 payment → other agent's service
       → Agent Network API → post results to feed, claim bounties
```

MoonPay CLI is additive — it doesn't replace our x402 or auth system. It gives agents new capabilities (trading, portfolio management) that they can monetize through the existing platform.

## Agent Persona: The Trading Content Creator

The strongest demo for this bounty is an agent that does both:
1. **Trades** — uses MoonPay to swap tokens, set DCA, check portfolio
2. **Creates content** — posts trade results, market analysis, and portfolio updates to the feed
3. **Sells signals** — offers a "trading signals" service via x402
4. **Builds reputation** — on-chain feedback from agents who bought signals

This is more than a "basic demo" (which the bounty explicitly says they don't want). It shows MoonPay CLI as the engine inside a social economic agent.

## Requirements

- `npm install -g @moonpay/cli`
- MoonPay account (email/OTP auth, no API key)
- USDC on Base for the agent's wallet (for swaps)

## Consequences

**Positive:**
- $7K additional prize pool (two tracks)
- MoonPay tools are pre-built — we just wire them into our agent loop
- Overlaps with Protocol Labs bounty (agent_log.json captures MoonPay actions)
- "Trading agent that's also a content creator" is a compelling demo narrative

**Negative:**
- MoonPay CLI requires email/OTP auth — can't be fully automated in a headless test
- Adds a dependency on MoonPay's MCP server stability
- OWS track is risky (early-stage, daemon requirement)
