---
name: wallet-test
description: Test all wallet and trading credential proxy endpoints. Use when asked to run wallet diagnostics or test trading infrastructure.
version: 1.0.0
tier: 1
---

# Wallet & Trading Infrastructure Test

Run a comprehensive test of all credential proxy wallet, trading, and Uniswap endpoints. This skill validates that the full trading pipeline is working correctly.

## When to use

- User asks to "test wallet", "run wallet diagnostics", or "test trading"
- After deployment to verify infrastructure is healthy
- Before executing a real trade to ensure endpoints are reachable

## How to run the test

Execute each test step below in order. After each step, report the result as PASS or FAIL. Stop on the first FAIL and report the error.

**Required env vars:** `$AGENT_ID`, `$CREDENTIAL_PROXY_URL`

### Test 1: Wallet Address

Verify the agent has a wallet.

```bash
RESULT=$(curl -s -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/address)
echo "Test 1 - Wallet Address: $RESULT"
```

**Expected:** `{"address":"0x..."}` with a valid 42-character hex address.
**FAIL condition:** HTTP error, empty response, or `{"error":"..."}`.

Save the address as `MY_ADDRESS` for subsequent tests.

### Test 2: RPC - ETH Balance

Verify the RPC proxy reaches Base mainnet.

```bash
RESULT=$(curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/rpc \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$MY_ADDRESS\",\"latest\"],\"id\":1}")
echo "Test 2 - ETH Balance: $RESULT"
```

**Expected:** `{"jsonrpc":"2.0","id":1,"result":"0x..."}`. The result is a hex-encoded wei balance. `0x0` means zero ETH.
**FAIL condition:** Connection error, timeout, or missing `result` field.

Convert and report: `0x0` = 0 ETH. Any non-zero value means the wallet is funded.

### Test 3: RPC - USDC Balance

Verify ERC-20 balance reading works.

```bash
# Pad address to 32 bytes for balanceOf(address) call
ADDR_NO_PREFIX=$(echo $MY_ADDRESS | sed 's/0x//')
PADDED_ADDR=$(printf '%064s' "$ADDR_NO_PREFIX" | tr ' ' '0')
RESULT=$(curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/rpc \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"data\":\"0x70a08231${PADDED_ADDR}\"},\"latest\"],\"id\":2}")
echo "Test 3 - USDC Balance: $RESULT"
```

**Expected:** `{"jsonrpc":"2.0","id":2,"result":"0x..."}`. Result is hex USDC balance (6 decimals).
**FAIL condition:** Connection error or missing `result` field.

### Test 4: Uniswap Quote

Verify the Uniswap Trading API proxy works and API key is valid.

```bash
RESULT=$(curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/uniswap/quote \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"EXACT_INPUT\",\"tokenIn\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"tokenInChainId\":8453,\"tokenOut\":\"0x4200000000000000000000000000000000000006\",\"tokenOutChainId\":8453,\"amount\":\"1000000\",\"swapper\":\"$MY_ADDRESS\",\"slippageTolerance\":0.5}")
echo "Test 4 - Uniswap Quote: $RESULT"
```

**Expected:** JSON with `quote` object containing `route`, `input`, `output`, and optionally `permitData`.
**FAIL condition:** HTTP 401/403 (bad API key), 503 (proxy not configured), or missing `quote` field.

Report: token pair, expected output amount, price impact, and whether `permitData` is present.

### Test 5: Permit2 Approval Check

Verify the approval check endpoint works.

```bash
RESULT=$(curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/uniswap/check_approval \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"amount\":\"1000000\",\"chainId\":8453,\"walletAddress\":\"$MY_ADDRESS\"}")
echo "Test 5 - Approval Check: $RESULT"
```

**Expected:** JSON response indicating whether approval is needed (may include an `approval` object with transaction data).
**FAIL condition:** HTTP error or connection failure.

### Test 6: Sign Typed Data (Permit2)

Test EIP-712 signing using the Permit2 data from the quote (Test 4).

If Test 4 returned `permitData`, use it here:

```bash
# Use the permitData from Test 4
RESULT=$(curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/wallet/sign-typed-data \
  -H "Content-Type: application/json" \
  -d '{
    "domain": PERMIT_DATA_DOMAIN_FROM_TEST_4,
    "types": PERMIT_DATA_TYPES_FROM_TEST_4,
    "primaryType": "PermitSingle",
    "message": PERMIT_DATA_VALUES_FROM_TEST_4
  }')
echo "Test 6 - Sign Typed Data: $RESULT"
```

**Expected:** `{"signature":"0x..."}` with a valid 132-character hex signature.
**FAIL condition:** Error response or missing `signature` field.

### Test 7: Uniswap Swap Calldata

Get the unsigned swap transaction using the quote and signature.

```bash
RESULT=$(curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/uniswap/swap \
  -H "Content-Type: application/json" \
  -d '{
    "quote": FULL_QUOTE_FROM_TEST_4,
    "signature": "SIGNATURE_FROM_TEST_6",
    "permitData": PERMIT_DATA_FROM_TEST_4
  }')
echo "Test 7 - Swap Calldata: $RESULT"
```

**Expected:** JSON with `swap` object containing `to`, `data`, `value`, `from` fields.
**FAIL condition:** Error response or missing swap transaction fields.

### Test 8: Trade Execute (DRY RUN)

**SKIP this test if the wallet has no ETH** — it will fail with "insufficient funds".

If the wallet IS funded, test the full `/trade/execute` endpoint:

```bash
RESULT=$(curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/trade/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tx": {
      "to": "SWAP_TO_FROM_TEST_7",
      "data": "SWAP_DATA_FROM_TEST_7",
      "value": "SWAP_VALUE_FROM_TEST_7"
    },
    "trade": {
      "tokenInAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "tokenOutAddress": "0x4200000000000000000000000000000000000006",
      "tokenInSymbol": "USDC",
      "tokenOutSymbol": "WETH",
      "amountIn": "1000000",
      "amountOut": "EXPECTED_OUTPUT_FROM_TEST_4",
      "amountInFormatted": "1.00",
      "amountOutFormatted": "FORMATTED_OUTPUT"
    }
  }')
echo "Test 8 - Trade Execute: $RESULT"
```

**Expected:** `{"txHash":"0x...","status":"pending","tradeLogged":true}`
**FAIL condition:** Error response. If "insufficient funds", report SKIP (wallet needs funding).

### Test 9: Update Holdings

Test the holdings update endpoint.

```bash
RESULT=$(curl -s -X POST -H "X-Agent-Id: $AGENT_ID" $CREDENTIAL_PROXY_URL/trade/update-holdings \
  -H "Content-Type: application/json" \
  -d "{\"holdings\":[{\"tokenAddress\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"tokenSymbol\":\"USDC\",\"decimals\":6,\"balance\":\"0\",\"balanceFormatted\":\"0.00\"},{\"tokenAddress\":\"0x4200000000000000000000000000000000000006\",\"tokenSymbol\":\"WETH\",\"decimals\":18,\"balance\":\"0\",\"balanceFormatted\":\"0.00\"}]}")
echo "Test 9 - Update Holdings: $RESULT"
```

**Expected:** `{"success":true}`
**FAIL condition:** Error response.

## Report Format

After running all tests, produce a summary table:

```
| Test | Endpoint             | Result | Details                    |
|------|----------------------|--------|----------------------------|
| 1    | /wallet/address      | PASS   | 0xabc...def                |
| 2    | /rpc (ETH balance)   | PASS   | 0.001 ETH                  |
| 3    | /rpc (USDC balance)  | PASS   | 0.00 USDC                  |
| 4    | /uniswap/quote       | PASS   | 1 USDC → 0.000469 WETH     |
| 5    | /uniswap/check_approval | PASS | Approval needed            |
| 6    | /wallet/sign-typed-data | PASS | Signature: 0x5034b...      |
| 7    | /uniswap/swap        | PASS   | Calldata received          |
| 8    | /trade/execute       | SKIP   | No ETH for gas             |
| 9    | /trade/update-holdings | PASS  | 2 tokens updated           |
```

If all tests pass (or SKIP for unfunded wallet), report: **WALLET INFRASTRUCTURE: HEALTHY**
If any test fails, report: **WALLET INFRASTRUCTURE: DEGRADED** with the failing test details.
