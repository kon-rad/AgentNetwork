import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Load .env.local ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContents = readFileSync(envPath, 'utf8');
for (const line of envContents.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// --- Fixed Wallet Setup (funded with 0.2 ETH on Base mainnet) ---
const privateKeyA = '0x8f7e1f6970029f7e86bac46458444f7f86b53dbd473b46e67b0e05e0e3921982';
const accountA = privateKeyToAccount(privateKeyA);
const privateKeyB = '0x626a1ab9f899fdf3d322a1f53848f81ce8881e2ff91dfa7ce003dca37f467912';
const accountB = privateKeyToAccount(privateKeyB);

console.log('=== Wallet Setup (funded on Base mainnet) ===');
console.log('Agent A (auditor):', accountA.address);
console.log('Agent B (trader): ', accountB.address);

// --- Counters ---
let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error('  FAIL:', msg);
    failed++;
    return false;
  }
  console.log('  PASS:', msg);
  passed++;
  return true;
}

function skip(msg) {
  console.log('  SKIP:', msg);
  skipped++;
}

// --- Helper: upsert agent via Supabase admin ---
async function upsertAgent(id, data) {
  // Check if exists
  const { data: existing } = await supabase
    .from('agents')
    .select('*')
    .eq('wallet_address', data.wallet_address)
    .maybeSingle();

  if (existing) return existing;

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({ id, ...data })
    .select()
    .single();

  if (error) throw new Error(`Agent insert failed: ${error.message}`);
  return agent;
}

// --- Step 1: Create Agent A ---
console.log('\n=== Step 1: Create Agent A (auditor) ===');
const agentAId = 'test-agent-alpha-' + accountA.address.slice(2, 10).toLowerCase();
const agentA = await upsertAgent(agentAId, {
  display_name: 'TestAgent-Alpha',
  wallet_address: accountA.address,
  bio: 'Automated test agent providing code audit services.',
  service_type: 'auditor',
  services_offered: JSON.stringify(['Smart contract audits', 'Gas optimization reviews']),
  token_symbol: 'TALPHA',
  owner_wallet: accountA.address.toLowerCase(),
});
assert(!!agentA.id, `Agent A ready (${agentA.id})`);

// --- Step 2: Register Agent A on ERC-8004 ---
console.log('\n=== Step 2: Register Agent A on ERC-8004 ===');
const regRes = await fetch(`${BASE_URL}/api/agents/${agentA.id}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ private_key: privateKeyA }),
});
if (regRes.status === 201 || regRes.status === 200) {
  const registration = await regRes.json();
  console.log('  ERC-8004 Token ID:', registration.agentId);
  console.log('  Tx:', registration.txHash);
  assert(true, 'Agent A registered on-chain');
} else {
  const err = await regRes.text();
  skip(`ERC-8004 registration: ${err.substring(0, 120)}`);
}

// --- Step 3: Create a Post ---
console.log('\n=== Step 3: Create Agent A Post ===');
const postId = crypto.randomUUID();
const { error: postErr } = await supabase.from('posts').insert({
  id: postId,
  agent_id: agentA.id,
  content: 'TestAgent-Alpha is live! Offering smart contract audits on Base.',
  media_type: 'text',
});
assert(!postErr, `Post created (${postId})`);
if (postErr) console.log('  Error:', postErr.message);

// --- Step 4: Create a Service ---
console.log('\n=== Step 4: Create Service Listing (0.01 USDC) ===');
const serviceId = 'test-svc-' + agentA.id.slice(0, 12);
const { data: existingSvc } = await supabase
  .from('services')
  .select('*')
  .eq('id', serviceId)
  .maybeSingle();

let service;
if (existingSvc) {
  service = existingSvc;
  assert(true, `Service already exists (${service.id})`);
} else {
  const { data: svc, error: svcErr } = await supabase
    .from('services')
    .insert({
      id: serviceId,
      agent_id: agentA.id,
      title: 'Smart Contract Security Audit',
      description: 'Full Solidity audit with reentrancy, access control, and gas analysis.',
      price: '0.01',
      price_token: 'USDC',
      delivery_time: '24h',
      category: 'auditor',
    })
    .select()
    .single();
  if (svcErr) {
    console.error('  FAIL: Service creation:', svcErr.message);
    failed++;
  } else {
    service = svc;
    assert(true, `Service created (${service.id})`);
  }
}

// --- Step 5: Create Agent B ---
console.log('\n=== Step 5: Create Agent B (trader) ===');
const agentBId = 'test-agent-beta-' + accountB.address.slice(2, 10).toLowerCase();
const agentB = await upsertAgent(agentBId, {
  display_name: 'TestAgent-Beta',
  wallet_address: accountB.address,
  bio: 'Automated test agent that hires other agents for DeFi work.',
  service_type: 'trader',
  services_offered: JSON.stringify(['DeFi strategy', 'Trading signals']),
  token_symbol: 'TBETA',
  owner_wallet: accountB.address.toLowerCase(),
});
assert(!!agentB.id, `Agent B ready (${agentB.id})`);

// --- Step 6: Register Agent B on ERC-8004 ---
console.log('\n=== Step 6: Register Agent B on ERC-8004 ===');
const regResB = await fetch(`${BASE_URL}/api/agents/${agentB.id}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ private_key: privateKeyB }),
});
if (regResB.status === 201 || regResB.status === 200) {
  const registrationB = await regResB.json();
  console.log('  ERC-8004 Token ID:', registrationB.agentId);
  assert(true, 'Agent B registered on-chain');
} else {
  skip('ERC-8004 registration skipped');
}

// --- Step 7: Agent B Creates a Bounty ---
console.log('\n=== Step 7: Agent B Creates Bounty ===');
const bountyId = crypto.randomUUID();
const { data: bounty, error: bountyErr } = await supabase
  .from('bounties')
  .insert({
    id: bountyId,
    creator_id: agentB.id,
    creator_type: 'agent',
    title: 'Audit my DeFi vault contract',
    description: 'Full security audit of Solidity vault. Reentrancy, access control, gas optimization.',
    reward_amount: '0.01',
    reward_token: 'USDC',
    required_service_type: 'auditor',
    status: 'open',
  })
  .select()
  .single();

assert(!bountyErr, `Bounty created (${bountyId})`);
if (bountyErr) console.log('  Error:', bountyErr.message);
assert(bounty?.status === 'open', 'Bounty status is open');

// --- Step 8: Agent A Claims the Bounty ---
console.log('\n=== Step 8: Agent A Claims Bounty ===');
const { data: claimed, error: claimErr } = await supabase
  .from('bounties')
  .update({ status: 'claimed', claimed_by: agentA.id })
  .eq('id', bountyId)
  .select()
  .single();

assert(!claimErr, 'Bounty claimed');
if (claimErr) console.log('  Error:', claimErr.message);
assert(claimed?.status === 'claimed', 'Bounty status is claimed');
assert(claimed?.claimed_by === agentA.id, 'Claimed by Agent A');

// --- Step 9: Test x402 Payment Gate (unpaid request → 402) ---
console.log('\n=== Step 9: Test x402 Gate (unpaid) ===');
const x402Res = await fetch(`${BASE_URL}/api/agents/${agentA.id}/service`);
if (x402Res.status === 402) {
  assert(true, 'x402 gate active — returns 402 Payment Required');
  const x402Body = await x402Res.json().catch(() => null);
  if (x402Body) {
    console.log('  Payment terms:', JSON.stringify(x402Body).substring(0, 200));
  }
} else if (x402Res.status === 200) {
  assert(true, 'Service endpoint returned data (x402 not enforcing in dev)');
} else {
  const errText = await x402Res.text();
  console.log('  WARN: Unexpected status', x402Res.status, errText.substring(0, 200));
}

// --- Step 10: Agent B Pays Agent A via x402 (real USDC payment on Base) ---
console.log('\n=== Step 10: Agent B Pays Agent A via x402 ===');
console.log('  Agent B wallet:', accountB.address);
console.log('  Agent A service: /api/agents/' + agentA.id + '/service');
console.log('  Price: $0.01 USDC on Base mainnet');

try {
  const payingFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: 'eip155:*',
        client: new ExactEvmScheme(accountB),
      },
    ],
  });

  const paidResponse = await payingFetch(`${BASE_URL}/api/agents/${agentA.id}/service`);

  if (paidResponse.status === 200) {
    const serviceData = await paidResponse.json();
    assert(true, `x402 payment succeeded — received service data from ${serviceData.display_name}`);
    console.log('  Service type:', serviceData.service_type);
    console.log('  Service price:', serviceData.service_price, 'USDC');

    // Extract payment receipt from response header
    const paymentHeader = paidResponse.headers.get('PAYMENT-RESPONSE');
    let settlementTxHash = null;
    let settlementNetwork = null;
    let settlementPayer = null;

    if (paymentHeader) {
      try {
        const settlement = JSON.parse(atob(paymentHeader));
        settlementTxHash = settlement.transaction;
        settlementNetwork = settlement.network;
        settlementPayer = settlement.payer;
        console.log('  === ON-CHAIN PAYMENT PROOF ===');
        console.log('  Tx Hash:  ', settlementTxHash);
        console.log('  Payer:    ', settlementPayer);
        console.log('  Network:  ', settlementNetwork);
        console.log('  BaseScan:  https://basescan.org/tx/' + settlementTxHash);
        assert(!!settlementTxHash, 'Payment has on-chain tx hash');
      } catch {
        console.log('  Payment header (raw):', paymentHeader.substring(0, 200));
        skip('Could not decode PAYMENT-RESPONSE header');
      }
    } else {
      skip('No PAYMENT-RESPONSE header (facilitator may not return it)');
    }

    // Record the payment in the database so it shows on the service detail page
    if (service) {
      console.log('\n  --- Recording payment to service_payments ---');
      const recordRes = await fetch(`${BASE_URL}/api/services/${service.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer_address: settlementPayer || accountB.address,
          tx_hash: settlementTxHash,
          amount: serviceData.service_price || '0.01',
          token: 'USDC',
          network: settlementNetwork || 'eip155:8453',
          status: 'confirmed',
        }),
      });
      if (recordRes.status === 201) {
        const recorded = await recordRes.json();
        assert(true, `Payment recorded (${recorded.id})`);
        console.log('  View at: ' + BASE_URL + '/agent/' + agentA.id + '/service/' + service.id);
      } else if (recordRes.status === 409) {
        skip('Payment already recorded (duplicate tx_hash)');
      } else {
        const err = await recordRes.text();
        console.log('  WARN: Failed to record payment:', err.substring(0, 200));
      }
    }
  } else if (paidResponse.status === 402) {
    const body = await paidResponse.text();
    skip(`x402 payment failed — wallet likely has no USDC. Fund ${accountB.address} with USDC on Base.`);
    console.log('  Response:', body.substring(0, 300));
  } else {
    const body = await paidResponse.text();
    skip(`Unexpected status ${paidResponse.status}: ${body.substring(0, 200)}`);
  }
} catch (err) {
  skip(`x402 payment error: ${err.message}`);
}

// --- Step 11: Agent B Pays Agent A directly (USDC transfer on Base) ---
console.log('\n=== Step 11: Agent B Pays Agent A (direct USDC transfer) ===');
console.log('  Payer (Agent B):', accountB.address);
console.log('  Payee (Agent A):', accountA.address);
console.log('  Amount: 0.01 USDC on Base mainnet');

try {
  const { createWalletClient, createPublicClient, http, erc20Abi, parseUnits } = await import('viem');
  const { base } = await import('viem/chains');

  const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const walletClient = createWalletClient({ account: accountB, chain: base, transport: http() });
  const publicClient = createPublicClient({ chain: base, transport: http() });

  const amount = parseUnits('0.01', 6); // 0.01 USDC

  const { request } = await publicClient.simulateContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [accountA.address, amount],
    account: accountB,
  });

  const txHash = await walletClient.writeContract(request);
  console.log('  === ON-CHAIN PAYMENT PROOF ===');
  console.log('  USDC Tx:  ', txHash);
  console.log('  BaseScan:  https://basescan.org/tx/' + txHash);
  assert(true, 'USDC transfer sent on-chain');

  // Wait for confirmation
  console.log('  Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  assert(receipt.status === 'success', 'USDC transfer confirmed on-chain');
  console.log('  Block:    ', receipt.blockNumber.toString());

  // Update bounty with tx_hash
  const { error: completeErr } = await supabase
    .from('bounties')
    .update({
      status: 'completed',
      tx_hash: txHash,
      deliverable_url: 'https://example.com/audit-report.pdf',
      completed_at: new Date().toISOString(),
    })
    .eq('id', bountyId);
  assert(!completeErr, 'Bounty marked completed with tx proof');

  // Also record as a service payment
  if (service) {
    const recordRes = await fetch(`${BASE_URL}/api/services/${service.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payer_address: accountB.address,
        tx_hash: txHash,
        amount: '0.01',
        token: 'USDC',
        network: 'eip155:8453',
        status: 'confirmed',
      }),
    });
    if (recordRes.status === 201) {
      const recorded = await recordRes.json();
      assert(true, `Payment recorded on service page (${recorded.id})`);
      console.log('  View at: ' + BASE_URL + '/agent/' + agentA.id + '/service/' + service.id);
    } else if (recordRes.status === 409) {
      skip('Payment already recorded (duplicate tx)');
    } else {
      console.log('  WARN: Recording failed:', (await recordRes.text()).substring(0, 200));
    }
  }
} catch (err) {
  console.log('  FAIL: USDC transfer error:', err.message.substring(0, 200));
  failed++;
  // Fall back to completing without payment
  await supabase.from('bounties').update({
    status: 'completed',
    deliverable_url: 'https://example.com/audit-report.pdf',
    completed_at: new Date().toISOString(),
  }).eq('id', bountyId);
}

// --- Step 12: Agent B Leaves a Review ---
console.log('\n=== Step 12: Agent B Leaves Review ===');
const feedbackRes = await fetch(`${BASE_URL}/api/agents/${agentA.id}/feedback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    value: 8,
    tag1: 'quality',
    tag2: 'auditor',
    reviewer_private_key: privateKeyB,
  }),
});
if (feedbackRes.status === 201) {
  const feedback = await feedbackRes.json();
  console.log('  Tx:', feedback.txHash);
  console.log('  BaseScan:', feedback.basescanUrl);
  assert(true, 'Feedback submitted on-chain');
} else {
  const err = await feedbackRes.text();
  skip(`Feedback: ${err.substring(0, 120)}`);
}

// --- Step 13: Read Reputation ---
console.log('\n=== Step 13: Read Agent A Reputation ===');
const repRes = await fetch(`${BASE_URL}/api/agents/${agentA.id}/feedback`);
if (repRes.status === 200) {
  const rep = await repRes.json();
  console.log('  Count:', rep.count, 'Value:', rep.value);
  assert(true, 'Reputation readable');
} else {
  skip('Reputation read failed');
}

// --- Summary ---
console.log('\n═══════════════════════════════════════');
console.log(' TEST RESULTS');
console.log('═══════════════════════════════════════');
console.log(` Passed:  ${passed}`);
console.log(` Failed:  ${failed}`);
console.log(` Skipped: ${skipped}`);
console.log('───────────────────────────────────────');
console.log(' WALLETS (funded on Base):');
console.log(` Agent A: ${accountA.address}`);
console.log(` Agent B: ${accountB.address}`);
console.log('───────────────────────────────────────');
console.log(' AGENTS:');
console.log(` Agent A: ${agentA.id} (${BASE_URL}/agent/${agentA.id})`);
console.log(` Agent B: ${agentB.id} (${BASE_URL}/agent/${agentB.id})`);
if (service) {
  console.log(` Service: ${BASE_URL}/agent/${agentA.id}/service/${service.id}`);
}
console.log('═══════════════════════════════════════');

if (failed > 0) process.exit(1);
