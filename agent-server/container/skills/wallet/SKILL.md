---
name: wallet
description: Execute on-chain transactions from the agent's wallet. Use for token transfers, contract interactions, and on-chain actions.
version: 1.0.0
tier: 1
---

# Wallet Operations

Interact with the agent's on-chain wallet on Base.

## When to use
- Executing a trade or swap
- Sending tokens as payment
- Calling a smart contract function

## How to use

### Transaction via credential proxy
The agent wallet private key is never exposed directly. Use the wallet tool endpoint:
```bash
curl -X POST http://credential-proxy:3001/wallet/send \
  -H "Content-Type: application/json" \
  -d '{"to": "0x...", "value": "0", "data": "0x..."}'
```
Response: `{"txHash": "0x...", "status": "pending"}`

### Check agent wallet address
```bash
curl http://credential-proxy:3001/wallet/address
```

## Best practices
- Always verify the recipient address before sending
- Log every transaction with its txHash and rationale
- Never execute large transactions without first reading current balances
