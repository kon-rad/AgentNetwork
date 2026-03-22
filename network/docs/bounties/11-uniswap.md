# Bounty 11: Uniswap — "Agentic Finance" ($5K)

**Prize:** $2,500 (1st) + $1,500 (2nd) + $1,000 (3rd)

## Requirements
- Integrate the Uniswap Trading API with a real Developer Platform API key
- Functional swaps with real TxIDs on testnet or mainnet
- Open source, public GitHub with README
- No mocks, no workarounds
- Bonus: deeper integration with Hooks, AI Skills, Unichain, v4 contracts, Permit2

## What Uniswap Gives Us

### Trading API
Base URL: `https://trade-api.gateway.uniswap.org/v1`
Auth: `x-api-key` header from https://developers.uniswap.org/dashboard/

| Endpoint | What it does |
|----------|-------------|
| `POST /quote` | Get swap quote with routing, gas estimate, Permit2 data |
| `POST /swap` | Convert quote into unsigned tx calldata (Classic, Bridge, Wrap) |
| `POST /order` | Create UniswapX gasless Dutch auction order |
| `POST /check_approval` | Check if token approval needed |
| `GET /swaps` | Check swap tx status |
| `GET /orders` | Check UniswapX order status |
| `POST /batch-swap` | Multiple swaps in one call |
| `GET /tokens/bridgeable` | List bridgeable tokens |

### Supported Chains
Base (8453), Ethereum (1), Arbitrum (42161), Optimism (10), Polygon (137), Unichain (130), Celo (42220), and 10+ more.

### 7 AI Skills (Claude Code Plugins)
Repo: https://github.com/Uniswap/uniswap-ai

Install via Claude Code:
```
/plugin marketplace add uniswap/uniswap-ai
/plugin install uniswap-trading
```

| Skill | What it does |
|-------|-------------|
| `swap-integration` | Integrate swaps via Trading API, Universal Router, or SDKs |
| `pay-with-any-token` | Pay x402 challenges using any token (auto-swaps to USDC) |
| `uniswap-v4-hooks` | v4 hook development with security guardrails |
| `swap-planner` | Plan swap execution strategies (TWAP, large orders) |
| `liquidity-planner` | Manage LP position strategies |
| `viem-integration` | EVM integration using viem/wagmi |
| CCA | Credible Commitment Auctions for order routing |

## How It Fits Our Architecture

### The Swap Flow
```
1. Agent calls Uniswap API: POST /quote
   → Gets quote + Permit2 data + routing

2. Agent signs Permit2 message (off-chain, gasless)

3. Agent calls: POST /swap (or /order for UniswapX)
   → Gets unsigned TransactionRequest { to, from, data, value, chainId }

4. Agent signs and broadcasts tx via viem
   → Gets txHash from RPC

5. Agent posts swap result to Neural HUD feed
   → Creates content from trading activity
```

### Key Insight: `pay-with-any-token` + x402

The `pay-with-any-token` skill lets agents pay x402 endpoints using **any token** by auto-swapping to USDC first. This means:
- An agent holding ETH can pay for a service priced in USDC
- The swap happens inline during the x402 payment flow
- This directly enhances our existing x402 agent-to-agent payment system

### Integration Points

| Neural HUD Feature | Uniswap Integration |
|--------------------|--------------------|
| Trader agent type | Uses Trading API for swaps on Base |
| Feed posts | Agent posts swap results with real TxIDs |
| x402 payments | `pay-with-any-token` lets agents pay with any token |
| Bounties | "Execute this swap" bounties with verifiable on-chain proof |
| agent_log.json | All swap TxIDs logged for Protocol Labs bounty overlap |
| Agent reputation | Successful trades build on-chain track record |

## Implementation Plan

### Phase 1: API Integration
1. Sign up at https://developers.uniswap.org/dashboard/ for API key
2. Create `src/lib/chain/uniswap.ts` — Trading API client wrapper
3. Add `UNISWAP_API_KEY` to `.env.local`

### Phase 2: Swap Endpoint
4. Create `POST /api/chain/swap` — accepts token pair + amount, returns quote, executes swap
5. Agent signs tx with their wallet, broadcasts via viem
6. Store txHash and link to BaseScan

### Phase 3: Agent Actions
7. Add swap action to autonomous loop (`src/lib/autonomous/agent-actions.ts`)
8. Trader agents discover swap opportunities, execute, and post results
9. All actions logged to agent_log.json with TxIDs

### Phase 4: x402 + Uniswap
10. Integrate `pay-with-any-token` so agents can pay for services with any token
11. Uniswap auto-swaps to USDC before x402 settlement

## Key Files to Create/Modify
- `src/lib/chain/uniswap.ts` — Trading API client (quote, swap, status)
- `src/app/api/chain/swap/route.ts` — Swap API endpoint
- `src/lib/autonomous/agent-actions.ts` — Add swap to autonomous loop
- `.claude/skills/uniswap-trader/SKILL.md` — Skill for trader agents

## API Key Requirement
**Must have a real Uniswap API key** — this is explicitly required by the bounty. Sign up at https://developers.uniswap.org/dashboard/. Free tier available.

## Permit2: Why It Matters for Agents
- Agent approves Permit2 **once** per token (one on-chain tx)
- All subsequent swaps use **off-chain EIP-712 signatures** (gasless)
- The Trading API returns `permitData` in quote responses — agent signs it, no extra approval tx
- Perfect for autonomous agents: minimize gas, maximize throughput

## Overlap with Other Bounties

| Bounty | Overlap |
|--------|---------|
| Protocol Labs "Agent Cook" | Swap TxIDs in agent_log.json |
| Base "Agent Services" | Swaps on Base mainnet, x402 payments |
| MoonPay CLI | MoonPay also does swaps — complementary or choose one |

## Status
New — needs API key signup and implementation.
