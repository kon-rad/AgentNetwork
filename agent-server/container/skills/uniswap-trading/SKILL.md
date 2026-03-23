---
name: uniswap-trading
description: Execute token swaps on Uniswap via the Trading API on Base mainnet. Use when swapping, trading, or exchanging tokens.
version: 1.0.0
tier: 1
---

# Uniswap Trading

Execute token swaps on Base mainnet via the Uniswap Trading API through the credential proxy.

## When to use

- User asks to swap, trade, or exchange tokens
- Agent needs to convert tokens (e.g., ETH to USDC for x402 payment)
- Checking token prices or swap quotes

## Key addresses (Base mainnet, chain ID 8453)

| Token | Address |
|-------|---------|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

## How to trade

All requests go through the credential proxy. The proxy injects API keys and signs transactions — you never handle private keys directly.

**Important:** Every request to the credential proxy MUST include the `X-Agent-Id` header. Use the `$AGENT_ID` env var for your agent ID and `$CREDENTIAL_PROXY_URL` for the proxy URL.

### Step 1: Get your wallet address

```bash
curl -s -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/address
```

Response: `{"address": "0x..."}`

### Step 2: Check your balance

```bash
# Check ETH balance
curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["YOUR_ADDRESS","latest"],"id":1}'

# Check ERC-20 token balance (e.g., USDC)
curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","data":"0x70a08231000000000000000000000000YOUR_ADDRESS_NO_0x"},"latest"],"id":1}'
```

### Step 3: Check if token approval is needed for Permit2

```bash
curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/uniswap/check_approval \
  -H "Content-Type: application/json" \
  -d '{
    "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "1000000",
    "chainId": 8453,
    "walletAddress": "YOUR_ADDRESS"
  }'
```

If approval is needed, the response includes an `approval` transaction object.

### Step 4: Approve Permit2 (one-time per token)

If Step 3 says approval is needed, send the approval transaction:

```bash
curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "data": "APPROVAL_DATA_FROM_STEP_3",
    "value": "0"
  }'
```

Response: `{"txHash": "0x...", "status": "pending"}`

Wait for confirmation, then proceed with the swap.

### Step 5: Get a swap quote

```bash
curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/uniswap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EXACT_INPUT",
    "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "tokenInChainId": 8453,
    "tokenOut": "0x4200000000000000000000000000000000000006",
    "tokenOutChainId": 8453,
    "amount": "1000000",
    "swapper": "YOUR_ADDRESS",
    "slippageTolerance": 0.5
  }'
```

The response includes:
- `quote`: price, gas estimate, route info
- `permitData`: EIP-712 typed data for Permit2 signature (if applicable)

**Check price impact before proceeding.** If price impact > 3% for volatile pairs, warn the user.

### Step 6: Sign Permit2 data (if quote includes permitData)

```bash
curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/sign-typed-data \
  -H "Content-Type: application/json" \
  -d '{
    "domain": PERMIT_DATA_DOMAIN_FROM_QUOTE,
    "types": PERMIT_DATA_TYPES_FROM_QUOTE,
    "primaryType": PERMIT_DATA_PRIMARY_TYPE_FROM_QUOTE,
    "message": PERMIT_DATA_VALUES_FROM_QUOTE
  }'
```

Response: `{"signature": "0x..."}`

### Step 7: Execute the swap

```bash
curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/uniswap/swap \
  -H "Content-Type: application/json" \
  -d '{
    "quote": FULL_QUOTE_FROM_STEP_5,
    "signature": "SIGNATURE_FROM_STEP_6",
    "permitData": PERMIT_DATA_FROM_STEP_5
  }'
```

Response includes an unsigned transaction: `{"to": "0x...", "data": "0x...", "value": "0x...", "chainId": 8453}`

### Step 8: Sign and broadcast the transaction

```bash
curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "TX_TO_FROM_STEP_7",
    "data": "TX_DATA_FROM_STEP_7",
    "value": "TX_VALUE_FROM_STEP_7"
  }'
```

Response: `{"txHash": "0x...", "status": "pending"}`

### Step 9: Verify the swap

```bash
curl -s -H "X-Agent-Id: $AGENT_ID" "$CREDENTIAL_PROXY_URL/uniswap/swaps?txHash=TX_HASH"
```

## After a successful swap

Always:
1. Log the trade: token pair, amount in, amount out, txHash, timestamp
2. Share the result with the user including a BaseScan link: `https://basescan.org/tx/{txHash}`
3. Post the swap result to the agent's feed if it's a significant trade

## Rules

- **Always check price impact** before executing. > 3% for volatile pairs = warn user first
- **Never set slippage above 5%**
- **Never trade more than requested** — match the user's specified amount exactly
- **Always verify the swap** completed before reporting success
- **Log every trade** with full details for audit trail

## Common token amounts

- USDC has 6 decimals: 1 USDC = `1000000`
- WETH has 18 decimals: 0.01 ETH = `10000000000000000`
- Always convert human-readable amounts to the correct decimal representation
