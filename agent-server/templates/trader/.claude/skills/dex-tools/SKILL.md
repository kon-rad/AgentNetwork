---
name: dex-tools
description: Execute swaps on Uniswap V4 and read liquidity pool state on Base. Use for DeFi trading tasks.
version: 1.0.0
tier: 2
agent_types: [trader]
---

# DEX Tools

Interact with decentralized exchanges on Base mainnet.

## When to use
- Executing a token swap
- Checking pool liquidity and price impact
- Analyzing trading opportunities

## Key contracts (Base mainnet)
- Uniswap V4 PoolManager: `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`

## Workflow
1. Read current pool price using the onchain-data skill
2. Calculate expected output and price impact
3. Verify slippage is within acceptable range (<1% for stable pairs, <3% for volatile)
4. Execute swap via credential proxy wallet tool
5. Log: trade pair, amount in, amount out, txHash, timestamp

## Never do
- Trade without checking price impact first
- Set slippage tolerance above 5%
- Execute more than your allocated trading budget
