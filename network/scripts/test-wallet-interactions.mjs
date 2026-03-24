#!/usr/bin/env node
/**
 * Test all wallet and trading credential proxy endpoints.
 *
 * Hits the live credential proxy on the VPS to verify every endpoint
 * in the trading pipeline works. Mirrors what an agent would do
 * using the wallet-test SKILL.md.
 *
 * Usage:
 *   node scripts/test-wallet-interactions.mjs [--proxy-url URL] [--agent-id ID]
 *
 * Defaults:
 *   --proxy-url  http://127.0.0.1:3001  (run via SSH or locally)
 *   --agent-id   Uses the first agent with a wallet in the DB
 *
 * Environment:
 *   PROXY_URL    Override proxy URL
 *   AGENT_ID     Override agent ID
 */

const args = process.argv.slice(2);
function getArg(name, envKey, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  if (process.env[envKey]) return process.env[envKey];
  return fallback;
}

const PROXY_URL = getArg('proxy-url', 'PROXY_URL', 'http://127.0.0.1:3001');
const AGENT_ID = getArg('agent-id', 'AGENT_ID', '');

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const WETH = '0x4200000000000000000000000000000000000006';

const results = [];

function log(test, endpoint, status, details) {
  results.push({ test, endpoint, status, details });
  const icon = status === 'PASS' ? '\x1b[32mPASS\x1b[0m' : status === 'SKIP' ? '\x1b[33mSKIP\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  [${icon}] Test ${test}: ${endpoint} — ${details}`);
}

async function proxyFetch(path, options = {}) {
  const url = `${PROXY_URL}${path}`;
  const headers = {
    'X-Agent-Id': AGENT_ID,
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, text, json, ok: res.ok };
}

async function main() {
  if (!AGENT_ID) {
    console.error('Error: --agent-id or AGENT_ID env var required');
    console.error('Usage: node scripts/test-wallet-interactions.mjs --agent-id <UUID>');
    process.exit(1);
  }

  console.log(`\n  Wallet Interaction Tests`);
  console.log(`  Proxy: ${PROXY_URL}`);
  console.log(`  Agent: ${AGENT_ID}`);
  console.log(`  ${'—'.repeat(50)}\n`);

  let myAddress = '';
  let ethBalance = 0n;
  let quoteData = null;
  let signature = '';
  let swapData = null;

  // ── Test 1: Wallet Address ──
  try {
    const res = await proxyFetch('/wallet/address');
    if (res.ok && res.json?.address) {
      myAddress = res.json.address;
      log(1, '/wallet/address', 'PASS', myAddress);
    } else {
      log(1, '/wallet/address', 'FAIL', res.json?.error || res.text);
      return printSummary();
    }
  } catch (e) {
    log(1, '/wallet/address', 'FAIL', e.message);
    return printSummary();
  }

  // ── Test 2: ETH Balance via RPC ──
  try {
    const res = await proxyFetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'eth_getBalance',
        params: [myAddress, 'latest'], id: 1,
      }),
    });
    if (res.ok && res.json?.result !== undefined) {
      ethBalance = BigInt(res.json.result);
      const ethFormatted = (Number(ethBalance) / 1e18).toFixed(6);
      log(2, '/rpc (ETH balance)', 'PASS', `${ethFormatted} ETH`);
    } else {
      log(2, '/rpc (ETH balance)', 'FAIL', res.json?.error?.message || res.text);
    }
  } catch (e) {
    log(2, '/rpc (ETH balance)', 'FAIL', e.message);
  }

  // ── Test 3: USDC Balance via RPC ──
  try {
    const addrNoPad = myAddress.slice(2).toLowerCase();
    const paddedAddr = addrNoPad.padStart(64, '0');
    const res = await proxyFetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'eth_call',
        params: [{ to: USDC, data: `0x70a08231${paddedAddr}` }, 'latest'], id: 2,
      }),
    });
    if (res.ok && res.json?.result !== undefined) {
      const usdcRaw = BigInt(res.json.result);
      const usdcFormatted = (Number(usdcRaw) / 1e6).toFixed(2);
      log(3, '/rpc (USDC balance)', 'PASS', `${usdcFormatted} USDC`);
    } else {
      log(3, '/rpc (USDC balance)', 'FAIL', res.json?.error?.message || res.text);
    }
  } catch (e) {
    log(3, '/rpc (USDC balance)', 'FAIL', e.message);
  }

  // ── Test 4: Uniswap Quote ──
  try {
    const res = await proxyFetch('/uniswap/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'EXACT_INPUT',
        tokenIn: USDC, tokenInChainId: 8453,
        tokenOut: WETH, tokenOutChainId: 8453,
        amount: '1000000',
        swapper: myAddress,
        slippageTolerance: 0.5,
      }),
    });
    if (res.ok && res.json?.quote) {
      quoteData = res.json;
      const outputAmt = quoteData.quote?.output?.amount;
      const formatted = outputAmt ? (Number(BigInt(outputAmt)) / 1e18).toFixed(6) : '?';
      log(4, '/uniswap/quote', 'PASS', `1 USDC → ${formatted} WETH, permitData: ${!!quoteData.permitData}`);
    } else {
      log(4, '/uniswap/quote', 'FAIL', res.json?.error || res.json?.detail || res.text?.slice(0, 100));
    }
  } catch (e) {
    log(4, '/uniswap/quote', 'FAIL', e.message);
  }

  // ── Test 5: Permit2 Approval Check ──
  try {
    const res = await proxyFetch('/uniswap/check_approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: USDC, amount: '1000000',
        chainId: 8453, walletAddress: myAddress,
      }),
    });
    if (res.ok) {
      const needsApproval = !!res.json?.approval;
      log(5, '/uniswap/check_approval', 'PASS', needsApproval ? 'Approval needed' : 'Already approved');
    } else {
      log(5, '/uniswap/check_approval', 'FAIL', res.json?.error || res.text?.slice(0, 100));
    }
  } catch (e) {
    log(5, '/uniswap/check_approval', 'FAIL', e.message);
  }

  // ── Test 6: Sign Typed Data (Permit2) ──
  if (quoteData?.permitData) {
    try {
      const res = await proxyFetch('/wallet/sign-typed-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: quoteData.permitData.domain,
          types: quoteData.permitData.types,
          primaryType: 'PermitSingle',
          message: quoteData.permitData.values,
        }),
      });
      if (res.ok && res.json?.signature) {
        signature = res.json.signature;
        log(6, '/wallet/sign-typed-data', 'PASS', `sig: ${signature.slice(0, 14)}...`);
      } else {
        log(6, '/wallet/sign-typed-data', 'FAIL', res.json?.error || res.text?.slice(0, 100));
      }
    } catch (e) {
      log(6, '/wallet/sign-typed-data', 'FAIL', e.message);
    }
  } else {
    log(6, '/wallet/sign-typed-data', 'SKIP', 'No permitData in quote');
  }

  // ── Test 7: Uniswap Swap Calldata ──
  if (quoteData?.quote && signature) {
    try {
      const res = await proxyFetch('/uniswap/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote: quoteData.quote,
          signature,
          permitData: quoteData.permitData,
        }),
      });
      if (res.ok && (res.json?.swap?.to || res.json?.to)) {
        swapData = res.json.swap || res.json;
        log(7, '/uniswap/swap', 'PASS', `to: ${swapData.to}, data: ${(swapData.data || '').slice(0, 14)}...`);
      } else {
        log(7, '/uniswap/swap', 'FAIL', JSON.stringify(res.json || res.text).slice(0, 120));
      }
    } catch (e) {
      log(7, '/uniswap/swap', 'FAIL', e.message);
    }
  } else {
    log(7, '/uniswap/swap', 'SKIP', 'Missing quote or signature from prior steps');
  }

  // ── Test 8: Trade Execute ──
  if (swapData && ethBalance > 0n) {
    try {
      const outputAmt = quoteData.quote?.output?.amount || '0';
      const res = await proxyFetch('/trade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx: {
            to: swapData.to,
            data: swapData.data,
            value: swapData.value || '0',
          },
          trade: {
            tokenInAddress: USDC,
            tokenOutAddress: WETH,
            tokenInSymbol: 'USDC',
            tokenOutSymbol: 'WETH',
            amountIn: '1000000',
            amountOut: outputAmt,
            amountInFormatted: '1.00',
            amountOutFormatted: (Number(BigInt(outputAmt)) / 1e18).toFixed(6),
          },
        }),
      });
      if (res.ok && res.json?.txHash) {
        log(8, '/trade/execute', 'PASS', `txHash: ${res.json.txHash.slice(0, 14)}..., logged: ${res.json.tradeLogged}`);
      } else {
        log(8, '/trade/execute', 'FAIL', res.json?.error || res.text?.slice(0, 100));
      }
    } catch (e) {
      log(8, '/trade/execute', 'FAIL', e.message);
    }
  } else if (!swapData) {
    log(8, '/trade/execute', 'SKIP', 'No swap calldata from prior steps');
  } else {
    log(8, '/trade/execute', 'SKIP', 'Wallet has no ETH for gas');
  }

  // ── Test 9: Update Holdings ──
  try {
    const res = await proxyFetch('/trade/update-holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holdings: [
          { tokenAddress: USDC, tokenSymbol: 'USDC', decimals: 6, balance: '0', balanceFormatted: '0.00' },
          { tokenAddress: WETH, tokenSymbol: 'WETH', decimals: 18, balance: '0', balanceFormatted: '0.00' },
        ],
      }),
    });
    if (res.ok && res.json?.success) {
      log(9, '/trade/update-holdings', 'PASS', '2 tokens updated');
    } else {
      log(9, '/trade/update-holdings', 'FAIL', res.json?.error || res.text?.slice(0, 100));
    }
  } catch (e) {
    log(9, '/trade/update-holdings', 'FAIL', e.message);
  }

  printSummary();
}

function printSummary() {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`\n  ${'—'.repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  if (failed === 0) {
    console.log(`  \x1b[32mWALLET INFRASTRUCTURE: HEALTHY\x1b[0m\n`);
  } else {
    console.log(`  \x1b[31mWALLET INFRASTRUCTURE: DEGRADED\x1b[0m`);
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`    ✗ Test ${r.test} (${r.endpoint}): ${r.details}`);
    }
    console.log();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
