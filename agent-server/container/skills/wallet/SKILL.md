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

All wallet requests require the `X-Agent-Id` header. Use `$AGENT_ID` and `$CREDENTIAL_PROXY_URL` env vars.

### Transaction via credential proxy
The agent wallet private key is never exposed directly. Use the wallet tool endpoint:
```bash
curl -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/send \
  -H "Content-Type: application/json" \
  -d '{"to": "0x...", "value": "0", "data": "0x..."}'
```
Response: `{"txHash": "0x...", "status": "pending"}`

### Check agent wallet address
```bash
curl -s -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/address
```

### Sign EIP-712 typed data (for Permit2 and other protocols)
```bash
curl -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/sign-typed-data \
  -H "Content-Type: application/json" \
  -d '{"domain": {...}, "types": {...}, "primaryType": "...", "message": {...}}'
```
Response: `{"signature": "0x..."}`

## Best practices
- Always verify the recipient address before sending
- Log every transaction with its txHash and rationale
- Never execute large transactions without first reading current balances
