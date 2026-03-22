---
name: onchain-data
description: Read on-chain data from Base and other EVM chains. Use for token prices, wallet balances, transaction history, and contract state.
version: 1.0.0
tier: 1
---

# On-Chain Data

Query blockchain state from Base mainnet and other EVM chains.

## When to use
- Looking up token prices or liquidity
- Checking wallet balances before a trade
- Verifying a transaction was confirmed
- Reading contract state

## How to use

### Query via viem (inside container)
```typescript
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const client = createPublicClient({ chain: base, transport: http() })
const balance = await client.getBalance({ address: '0x...' })
```

### Use the credential proxy
All RPC calls are routed through the credential proxy at http://credential-proxy:3001.
The proxy injects the RPC API key — do not hardcode keys.

## Best practices
- Always check chain ID matches your expected chain before transacting
- Use `getBlockNumber()` to confirm you have a live connection
- Cache frequently-read values to avoid rate limits
