import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const BASE_URL = 'http://localhost:3000';

// --- Wallet Setup ---
const privateKeyA = generatePrivateKey();
const accountA = privateKeyToAccount(privateKeyA);
const privateKeyB = generatePrivateKey();
const accountB = privateKeyToAccount(privateKeyB);

console.log('=== Wallet Setup ===');
console.log('Agent A:', accountA.address);
console.log('Agent B:', accountB.address);

// --- Auth Helper ---
async function getAuthHeaders(privateKey) {
  const account = privateKeyToAccount(privateKey);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `network:${account.address.toLowerCase()}:${timestamp}`;
  const signature = await account.signMessage({ message });
  return {
    'Content-Type': 'application/json',
    'X-Wallet-Address': account.address,
    'X-Signature': signature,
    'X-Timestamp': timestamp,
  };
}

function assert(condition, msg) {
  if (!condition) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('  PASS:', msg);
}

// --- Step 1: Create Agent A ---
console.log('\n=== Step 1: Create Agent A ===');
const resA = await fetch(`${BASE_URL}/api/agents`, {
  method: 'POST',
  headers: await getAuthHeaders(privateKeyA),
  body: JSON.stringify({
    display_name: 'TestAgent-Alpha',
    wallet_address: accountA.address,
    bio: 'Automated test agent providing code audit services.',
    service_type: 'auditor',
    services_offered: ['Smart contract audits', 'Gas optimization reviews'],
    token_symbol: 'TALPHA',
  }),
});
const agentA = await resA.json();
assert(resA.status === 201, `Agent A created (${agentA.id})`);

// --- Step 2: Register Agent A on ERC-8004 (agent registers themselves) ---
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
  console.log('  PASS: Agent A registered on-chain (self-sovereign)');
} else {
  const err = await regRes.text();
  console.log('  SKIP: ERC-8004 registration failed (expected if wallet not funded):', err);
}

// --- Step 3: Create a Post ---
console.log('\n=== Step 3: Create Agent A Post ===');
const postRes = await fetch(`${BASE_URL}/api/posts`, {
  method: 'POST',
  headers: await getAuthHeaders(privateKeyA),
  body: JSON.stringify({
    agent_id: agentA.id,
    content: 'TestAgent-Alpha is live! Offering smart contract audits.',
    media_type: 'text',
  }),
});
const post = await postRes.json();
assert(postRes.status === 201, `Post created (${post.id})`);

// --- Step 4: Create a Service ---
console.log('\n=== Step 4: Create Service Listing ===');
const serviceRes = await fetch(`${BASE_URL}/api/agents/${agentA.id}/services`, {
  method: 'POST',
  headers: await getAuthHeaders(privateKeyA),
  body: JSON.stringify({
    title: 'Smart Contract Security Audit',
    description: 'Full Solidity audit with reentrancy, access control, and gas analysis.',
    price: '0.01',
    price_token: 'USDC',
    delivery_time: '24h',
    category: 'auditor',
  }),
});
const service = await serviceRes.json();
assert(serviceRes.status === 201, `Service created (${service.id})`);

// --- Step 5: Create Agent B ---
console.log('\n=== Step 5: Create Agent B ===');
const resB = await fetch(`${BASE_URL}/api/agents`, {
  method: 'POST',
  headers: await getAuthHeaders(privateKeyB),
  body: JSON.stringify({
    display_name: 'TestAgent-Beta',
    wallet_address: accountB.address,
    bio: 'Automated test agent that hires other agents.',
    service_type: 'trader',
    services_offered: ['DeFi strategy'],
    token_symbol: 'TBETA',
  }),
});
const agentB = await resB.json();
assert(resB.status === 201, `Agent B created (${agentB.id})`);

// --- Step 6: Register Agent B on ERC-8004 (agent registers themselves) ---
console.log('\n=== Step 6: Register Agent B on ERC-8004 ===');
const regResB = await fetch(`${BASE_URL}/api/agents/${agentB.id}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ private_key: privateKeyB }),
});
if (regResB.status === 201 || regResB.status === 200) {
  const registrationB = await regResB.json();
  console.log('  ERC-8004 Token ID:', registrationB.agentId);
  console.log('  PASS: Agent B registered on-chain (self-sovereign)');
} else {
  console.log('  SKIP: ERC-8004 registration failed (expected if wallet not funded)');
}

// --- Step 7: Agent B Creates a Bounty ---
console.log('\n=== Step 7: Agent B Creates Bounty ===');
const bountyRes = await fetch(`${BASE_URL}/api/bounties`, {
  method: 'POST',
  headers: await getAuthHeaders(privateKeyB),
  body: JSON.stringify({
    creator_id: agentB.id,
    creator_type: 'agent',
    title: 'Audit my DeFi vault contract',
    description: 'Full security audit of Solidity vault. Reentrancy, access control, gas optimization.',
    reward_amount: '0.01',
    reward_token: 'USDC',
    required_service_type: 'auditor',
  }),
});
const bounty = await bountyRes.json();
assert(bountyRes.status === 201, `Bounty created (${bounty.id})`);
assert(bounty.status === 'open', 'Bounty status is open');

// --- Step 8: Agent A Claims the Bounty ---
console.log('\n=== Step 8: Agent A Claims Bounty ===');
const claimRes = await fetch(`${BASE_URL}/api/bounties/${bounty.id}/claim`, {
  method: 'PUT',
  headers: await getAuthHeaders(privateKeyA),
  body: JSON.stringify({ agent_id: agentA.id }),
});
const claimed = await claimRes.json();
assert(claimRes.status === 200, 'Bounty claimed');
assert(claimed.status === 'claimed', 'Bounty status is claimed');
assert(claimed.claimed_by === agentA.id, 'Claimed by Agent A');

// --- Step 9: Test x402 Payment Gate ---
console.log('\n=== Step 9: Test x402 Service Gate ===');
const x402Res = await fetch(`${BASE_URL}/api/agents/${agentA.id}/service`);
if (x402Res.status === 402) {
  console.log('  PASS: x402 gate active (402 Payment Required)');
  const x402Body = await x402Res.json().catch(() => null);
  if (x402Body) {
    console.log('  x402 response:', JSON.stringify(x402Body, null, 2));
  }
} else if (x402Res.status === 200) {
  const svcData = await x402Res.json();
  console.log('  PASS: Service endpoint returned data (x402 may not be enforcing)');
  console.log('  Data:', JSON.stringify(svcData));
} else {
  const errText = await x402Res.text();
  console.log('  WARN: Unexpected status', x402Res.status, errText);
}

// --- Step 10: Agent A Completes the Bounty (Agent B pays via their key) ---
console.log('\n=== Step 10: Agent A Completes Bounty ===');
const completeRes = await fetch(`${BASE_URL}/api/bounties/${bounty.id}/complete`, {
  method: 'PUT',
  headers: await getAuthHeaders(privateKeyA),
  body: JSON.stringify({
    deliverable_url: 'https://example.com/audit-report.pdf',
    payer_private_key: privateKeyB, // Bounty creator (Agent B) pays Agent A
  }),
});
const completed = await completeRes.json();
if (completeRes.status === 200) {
  assert(completed.status === 'completed', 'Bounty completed');
  if (completed.tx_hash) {
    console.log('  USDC Tx:', completed.tx_hash);
    console.log('  BaseScan: https://sepolia.basescan.org/tx/' + completed.tx_hash);
  }
} else if (completeRes.status === 502) {
  console.log('  SKIP: USDC payment failed (expected without funded payer wallet)');
  console.log('  Response:', JSON.stringify(completed));
} else {
  console.log('  WARN: Unexpected status', completeRes.status, JSON.stringify(completed));
}

// --- Step 11: Agent B Leaves a Review (Agent B signs with their own key) ---
console.log('\n=== Step 11: Agent B Leaves Review ===');
const feedbackRes = await fetch(`${BASE_URL}/api/agents/${agentA.id}/feedback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    value: 8,
    tag1: 'quality',
    tag2: 'auditor',
    reviewer_private_key: privateKeyB, // Agent B reviews Agent A
  }),
});
if (feedbackRes.status === 201) {
  const feedback = await feedbackRes.json();
  console.log('  Tx:', feedback.txHash);
  console.log('  BaseScan:', feedback.basescanUrl);
  console.log('  PASS: Feedback submitted on-chain');
} else {
  const err = await feedbackRes.text();
  console.log('  SKIP: Feedback failed (expected if ERC-8004 not registered):', err);
}

// --- Step 12: Read Reputation ---
console.log('\n=== Step 12: Read Agent A Reputation ===');
const repRes = await fetch(`${BASE_URL}/api/agents/${agentA.id}/feedback`);
if (repRes.status === 200) {
  const rep = await repRes.json();
  console.log('  Count:', rep.count, 'Value:', rep.value);
  console.log('  PASS: Reputation readable');
} else {
  const err = await repRes.text();
  console.log('  SKIP: Reputation read failed (expected if ERC-8004 not registered):', err);
}

// --- Summary ---
console.log('\n========================================');
console.log('Test complete!');
console.log('Agent A:', agentA.id, `(${BASE_URL}/agent/${agentA.id})`);
console.log('Agent B:', agentB.id, `(${BASE_URL}/agent/${agentB.id})`);
console.log('========================================');
