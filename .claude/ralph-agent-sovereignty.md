# RALPH LOOP: Agent Sovereignty Refactor

You are refactoring Neural HUD so that agents are self-sovereign economic actors. The platform is a coordination layer — it NEVER holds private keys or pays on behalf of agents.

## COMPLETION PROMISE

When ALL tasks below are done and verified, output:
```
<promise>AGENT SOVEREIGNTY COMPLETE</promise>
```

Do NOT output the promise until every verification check passes.

## CONTEXT

- This is a Next.js 16 app with Supabase (not SQLite)
- Auth is SIWE (Sign-In with Ethereum) via iron-session
- Chain modules are in `src/lib/chain/`
- API routes are in `src/app/api/`
- ERC-8004 contracts on Base Sepolia:
  - IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
  - ReputationRegistry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- IMPORTANT: Read `AGENTS.md` before writing any Next.js code — this version has breaking changes

## CURRENT PROBLEMS

1. `src/lib/chain/erc8004.ts` — `registerAgent()` and `submitFeedback()` use a single `AGENT_PRIVATE_KEY` env var. One server wallet owns all agents and submits all feedback. The ERC-8004 contract explicitly prohibits self-review (giveFeedback reverts if caller == agent owner).

2. `src/app/api/bounties/[id]/complete/route.ts` — Uses `transferUsdc()` which reads `BOUNTY_PAYER_PRIVATE_KEY`. A single platform wallet pays all bounties instead of the bounty creator paying.

3. `src/app/api/agents/[id]/register/route.ts` — Calls `registerAgent()` with the server key. All agents get registered under one wallet.

4. `src/app/api/agents/[id]/feedback/route.ts` — Calls `submitFeedback()` with the server key. Will revert on-chain if that key also owns the agent.

5. `src/lib/autonomous/agent-actions.ts` — `registerIdentityAction()` and `completeBountyAction()` use server wallets.

## TASKS

### Task 1: Refactor `src/lib/chain/erc8004.ts`

Make `registerAgent()` and `submitFeedback()` accept a `privateKey` parameter instead of reading from env:

```typescript
export async function registerAgent(
  agentURI: string,
  privateKey: `0x${string}`,
): Promise<{ agentId: bigint; txHash: string }>
```

```typescript
export async function submitFeedback(
  agentId: bigint,
  value: number,
  tag1: string,
  tag2: string,
  reviewerPrivateKey: `0x${string}`,
): Promise<string>
```

Remove `getWalletClient()` that reads from `AGENT_PRIVATE_KEY`. Create wallet clients inline from the provided key. Keep `getPublicClient()` as-is (read-only, no key needed). Keep `getReputationSummary()` as-is (read-only).

### Task 2: Refactor `src/lib/chain/usdc.ts`

Make `transferUsdc()` accept a `payerPrivateKey` parameter instead of reading `BOUNTY_PAYER_PRIVATE_KEY`:

```typescript
export async function transferUsdc(
  toAddress: `0x${string}`,
  amount: string,
  payerPrivateKey: `0x${string}`,
): Promise<`0x${string}`>
```

### Task 3: Refactor `src/app/api/agents/[id]/register/route.ts`

The agent registers themselves. Two paths:

**Path A — API agents (with private key):**
Accept `private_key` in the POST request body. The agent's own wallet calls `register(agentURI)`.

**Path B — Browser users (SIWE session):**
If no `private_key` in body, return the unsigned transaction calldata so the frontend wallet can sign it. (For now, just require private_key in body — we can add the unsigned-tx path later.)

Validate that the private key derives to the agent's `wallet_address` before proceeding.

### Task 4: Refactor `src/app/api/agents/[id]/feedback/route.ts`

Accept `reviewer_private_key` in the POST body. The reviewer's wallet calls `giveFeedback()`.

Validate:
- The reviewer's wallet address (derived from key) is NOT the agent's wallet_address (prevent self-review before hitting the contract)
- The agent is registered on ERC-8004

### Task 5: Refactor `src/app/api/bounties/[id]/complete/route.ts`

The bounty creator pays, not the platform. When Agent A completes a bounty:
1. Look up the bounty creator (Agent B)
2. Accept `payer_private_key` in the request body (Agent B's key)
3. Validate the key derives to the bounty creator's wallet
4. Call `transferUsdc(agentA.wallet_address, reward_amount, payerPrivateKey)`

If no `payer_private_key` is provided and reward_amount > 0, return 400 with a clear error message explaining the bounty creator must provide their key to release payment.

### Task 6: Refactor `src/lib/autonomous/agent-actions.ts`

Update all action functions to accept and pass through private keys:
- `registerIdentityAction(agent, log, privateKey)`
- `completeBountyAction(agent, log, privateKey)` — the payer key
- Any other function that currently uses `AGENT_PRIVATE_KEY` or `BOUNTY_PAYER_PRIVATE_KEY`

### Task 7: Update `scripts/test-agent-flow.mjs`

Update the test script to pass private keys in request bodies:
- Step 2 (register Agent A): pass `privateKeyA` in body
- Step 6 (register Agent B): pass `privateKeyB` in body
- Step 10 (complete bounty): pass `privateKeyB` (bounty creator) as `payer_private_key`
- Step 11 (leave review): pass `privateKeyB` as `reviewer_private_key`

### Task 8: Update skill and docs

Update `.claude/skills/x402-agent/SKILL.md`:
- Registration section: show passing `private_key` in body
- Feedback section: show passing `reviewer_private_key` in body

Update `docs/testing-for-agents.md`:
- All steps that now require private keys in request bodies

### Task 9: Clean up env vars

Remove references to `AGENT_PRIVATE_KEY` and `BOUNTY_PAYER_PRIVATE_KEY` from:
- Any route that no longer needs them
- README.md env vars section
- `docs/testing-for-agents.md` env vars table

Keep `FILECOIN_PRIVATE_KEY` (platform storage service is acceptable for hackathon).

## VERIFICATION CHECKLIST

Before outputting the completion promise, verify ALL of these:

- [ ] `src/lib/chain/erc8004.ts` — `registerAgent()` accepts `privateKey` param, no `AGENT_PRIVATE_KEY` env read
- [ ] `src/lib/chain/erc8004.ts` — `submitFeedback()` accepts `reviewerPrivateKey` param, no `AGENT_PRIVATE_KEY` env read
- [ ] `src/lib/chain/erc8004.ts` — `getReputationSummary()` unchanged (read-only)
- [ ] `src/lib/chain/usdc.ts` — `transferUsdc()` accepts `payerPrivateKey` param, no `BOUNTY_PAYER_PRIVATE_KEY` env read
- [ ] `src/app/api/agents/[id]/register/route.ts` — accepts `private_key` in body, validates it matches agent's wallet
- [ ] `src/app/api/agents/[id]/feedback/route.ts` — accepts `reviewer_private_key` in body, validates not self-review
- [ ] `src/app/api/bounties/[id]/complete/route.ts` — accepts `payer_private_key`, validates it matches bounty creator
- [ ] `src/lib/autonomous/agent-actions.ts` — all actions accept private key params
- [ ] `scripts/test-agent-flow.mjs` — passes private keys in request bodies
- [ ] No remaining reads of `AGENT_PRIVATE_KEY` in chain modules or API routes (grep to confirm)
- [ ] No remaining reads of `BOUNTY_PAYER_PRIVATE_KEY` in chain modules or API routes (grep to confirm)
- [ ] `FILECOIN_PRIVATE_KEY` still used (this is fine — platform storage service)
- [ ] All modified files have no TypeScript errors visible in their own scope

## ITERATION STRATEGY

Each iteration, pick the next uncompleted task in order. Do NOT skip ahead. After completing a task:
1. Verify your changes compile (check for obvious type errors)
2. Grep to confirm no remaining references to removed env vars in modified files
3. Move to the next task

If you encounter an issue or ambiguity, make the simplest reasonable choice and document it in a code comment.
