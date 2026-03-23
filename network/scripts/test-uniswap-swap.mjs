#!/usr/bin/env node
/**
 * Test script for the Uniswap Trading API swap flow.
 *
 * Tests the full flow directly against the Uniswap Trading API:
 *   1. Generate a wallet (viem)
 *   2. Get a swap quote (Uniswap Trading API)
 *   3. Check token approval status
 *   4. (If funded) Execute a real swap
 *
 * Usage:
 *   UNISWAP_API_KEY=... node scripts/test-uniswap-swap.mjs [--dry-run]
 *
 * Flags:
 *   --dry-run   Only test quote + approval check, skip actual swap execution
 */

import { createWalletClient, createPublicClient, http, formatEther, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const UNISWAP_API_URL = 'https://trade-api.gateway.uniswap.org/v1';
const API_KEY = process.env.UNISWAP_API_KEY;

// Base mainnet tokens
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const WETH = '0x4200000000000000000000000000000000000006';

const isDryRun = process.argv.includes('--dry-run');

function log(label, data) {
  console.log(`\n=== ${label} ===`);
  if (typeof data === 'object') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

async function uniswapFetch(endpoint, body) {
  const url = `${UNISWAP_API_URL}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Uniswap API ${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  if (!API_KEY) {
    console.error('Error: UNISWAP_API_KEY environment variable is required');
    console.error('Get one at: https://developers.uniswap.org/dashboard/');
    process.exit(1);
  }

  console.log(`Uniswap Trading API Test (${isDryRun ? 'DRY RUN' : 'LIVE'})`);
  console.log('='.repeat(50));

  // Step 1: Generate a test wallet
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  log('Step 1: Generated test wallet', { address: account.address });

  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  // Check ETH balance
  const ethBalance = await publicClient.getBalance({ address: account.address });
  log('ETH Balance', formatEther(ethBalance) + ' ETH');

  // Step 2: Get a swap quote (USDC → WETH, 1 USDC)
  const quoteAmount = '1000000'; // 1 USDC (6 decimals)
  log('Step 2: Getting swap quote', {
    tokenIn: 'USDC',
    tokenOut: 'WETH',
    amount: '1 USDC',
    chain: 'Base (8453)',
  });

  try {
    const quote = await uniswapFetch('/quote', {
      type: 'EXACT_INPUT',
      tokenIn: USDC,
      tokenInChainId: 8453,
      tokenOut: WETH,
      tokenOutChainId: 8453,
      amount: quoteAmount,
      swapper: account.address,
      slippageTolerance: 0.5,
    });

    log('Quote received', {
      amountIn: quote.quote?.amountIn || 'N/A',
      amountOut: quote.quote?.amountOut || 'N/A',
      gasEstimate: quote.quote?.gasEstimate || 'N/A',
      route: quote.quote?.route ? 'Found' : 'N/A',
      hasPermitData: !!quote.permitData,
    });

    // Step 3: Check token approval for Permit2
    log('Step 3: Checking Permit2 approval status', {
      token: 'USDC',
      walletAddress: account.address,
    });

    const approval = await uniswapFetch('/check_approval', {
      token: USDC,
      amount: quoteAmount,
      chainId: 8453,
      walletAddress: account.address,
    });

    log('Approval status', {
      needsApproval: !!approval.approval,
      approvalTarget: approval.approval?.to || 'N/A (already approved or no approval needed)',
    });

    if (isDryRun) {
      log('DRY RUN COMPLETE', 'Quote and approval check succeeded. Skipping actual swap execution.');
      log('Summary', {
        apiKeyWorking: true,
        quoteEndpoint: 'OK',
        approvalEndpoint: 'OK',
        readyForLiveTrading: ethBalance > 0n,
        walletFunded: ethBalance > 0n,
      });
      return;
    }

    // Step 4: Execute swap (only if wallet is funded)
    if (ethBalance === 0n) {
      log('SKIPPING SWAP', `Wallet ${account.address} has no ETH for gas. Fund it to test live swaps.`);
      log('Summary', {
        apiKeyWorking: true,
        quoteEndpoint: 'OK',
        approvalEndpoint: 'OK',
        readyForLiveTrading: false,
        fundingNeeded: `Send ~0.001 ETH to ${account.address} on Base`,
      });
      return;
    }

    // If we have funds and permitData, sign it
    if (quote.permitData) {
      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(),
      });

      log('Step 4: Signing Permit2 data');
      const signature = await walletClient.signTypedData({
        domain: quote.permitData.domain,
        types: quote.permitData.types,
        primaryType: quote.permitData.primaryType,
        message: quote.permitData.values,
      });
      log('Permit2 signature', { signature: signature.slice(0, 20) + '...' });

      // Get swap calldata
      log('Step 5: Getting swap calldata');
      const swap = await uniswapFetch('/swap', {
        quote: quote.quote,
        signature,
        permitData: quote.permitData,
      });
      log('Swap calldata received', {
        to: swap.to,
        value: swap.value,
        hasData: !!swap.data,
      });

      // Sign and broadcast
      log('Step 6: Broadcasting transaction');
      const txHash = await walletClient.sendTransaction({
        to: swap.to,
        data: swap.data,
        value: swap.value ? BigInt(swap.value) : 0n,
      });
      log('Transaction sent!', {
        txHash,
        basescan: `https://basescan.org/tx/${txHash}`,
      });
    }

  } catch (err) {
    log('ERROR', {
      message: err.message,
      hint: err.message.includes('401') || err.message.includes('403')
        ? 'API key may be invalid or expired. Check https://developers.uniswap.org/dashboard/'
        : err.message.includes('429')
        ? 'Rate limited. Wait and retry.'
        : 'Check the error details above.',
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
