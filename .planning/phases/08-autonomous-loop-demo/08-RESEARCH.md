# Phase 8: Autonomous Loop + Demo - Research

**Researched:** 2026-03-21
**Domain:** Autonomous agent orchestration, API composition, on-chain transaction scripting
**Confidence:** HIGH

## Summary

Phase 8 is an integration/orchestration phase, not a new-library phase. All building blocks exist: ERC-8004 registration, Clanker token deploy, x402 payments, NFT minting, Filecoin storage, bounty CRUD, and post CRUD are all implemented as API routes. The autonomous loop is a server-side script that calls these existing endpoints in sequence for each demo agent, logging every decision to agent_log.json and uploading logs to Filecoin.

The core challenge is scripting a deterministic "autonomous" demo that exercises all prior phases end-to-end without manual intervention. This is NOT an LLM-powered agent loop -- it is a scripted orchestration that simulates autonomous behavior by having each agent discover bounties matching its service_type, claim them, create posts, register identity, mint NFTs, and complete bounties. The demo video captures this running live.

**Primary recommendation:** Build a single `src/lib/autonomous/runner.ts` module that orchestrates the full agent lifecycle via internal function calls (not HTTP fetches to self), with an API trigger route at `/api/autonomous/run`. Each agent runs sequentially to avoid nonce conflicts on shared wallets. All actions are logged via the existing `addLogEntry()` and uploaded to Filecoin at the end.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.8.0 | Direct DB access for agent/bounty queries | Already in use, server-side only |
| viem | 2.47.5 | On-chain transaction building | Already in use for all chain modules |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | - | - | All dependencies already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTTP self-fetch to API routes | Direct function imports | Direct imports avoid network overhead, auth issues, and base URL problems in server scripts |
| LLM-powered agent decisions | Scripted deterministic logic | Scripted is reliable for demo; LLM adds latency, cost, and non-determinism |
| Parallel agent execution | Sequential execution | Sequential avoids nonce conflicts on shared operator wallet |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    autonomous/
      runner.ts          # Main orchestration loop
      agent-actions.ts   # Individual action functions (discover, claim, post, register, mint, complete)
      demo-scenarios.ts  # Pre-defined bounty/post content for each agent persona
  app/
    api/
      autonomous/
        run/route.ts     # POST trigger endpoint for the demo
        status/route.ts  # GET endpoint returning current run status/logs
```

### Pattern 1: Sequential Agent Runner
**What:** A single async function that iterates through demo agents and executes a scripted action sequence
**When to use:** For the demo -- ensures deterministic, repeatable behavior
**Example:**
```typescript
// src/lib/autonomous/runner.ts
import { getDb } from '@/lib/db'
import { buildAgentLog, addLogEntry, type AgentLog } from '@/lib/agent-log'
import { uploadToFilecoin } from '@/lib/chain/filecoin'
import type { Agent } from '@/lib/types'

export interface RunResult {
  agentId: string
  agentName: string
  actions: { action: string; status: 'success' | 'failure'; details: Record<string, unknown> }[]
  logFilecoinCid: string | null
}

export async function runAutonomousLoop(): Promise<RunResult[]> {
  const db = getDb()
  const agents = db.prepare('SELECT * FROM agents').all() as Agent[]
  const results: RunResult[] = []

  for (const agent of agents) {
    let log = buildAgentLog(agent)
    const actions: RunResult['actions'] = []

    // Step 1: Register identity (idempotent)
    // Step 2: Discover matching bounties
    // Step 3: Claim an open bounty
    // Step 4: Create a post about the work
    // Step 5: Mint post as NFT
    // Step 6: Complete the bounty
    // Step 7: Upload final log to Filecoin

    // Each step wraps in try/catch, logs entry, continues on failure
    results.push({ agentId: agent.id, agentName: agent.display_name, actions, logFilecoinCid: null })
  }

  return results
}
```

### Pattern 2: Direct Function Import (Not HTTP Self-Fetch)
**What:** Import chain modules and DB operations directly instead of fetching own API routes
**When to use:** Always for server-side orchestration scripts
**Why:** Avoids base URL issues (localhost vs deployed), authentication overhead, and unnecessary serialization
**Example:**
```typescript
// GOOD: Direct import
import { registerAgent } from '@/lib/chain/erc8004'
import { uploadToFilecoin } from '@/lib/chain/filecoin'
import { deployAgentToken } from '@/lib/chain/clanker'
import { mintPostNFT, deployCollection } from '@/lib/chain/nft'
import { transferUsdc } from '@/lib/chain/usdc'
import { buildAgentCard } from '@/lib/agent-card'
import { buildAgentLog, addLogEntry } from '@/lib/agent-log'

// BAD: Self-fetch
const res = await fetch('http://localhost:3000/api/agents/123/register', { method: 'POST' })
```

### Pattern 3: Idempotent Actions
**What:** Every action checks if already done before executing
**When to use:** Always -- the demo must be re-runnable
**Why:** All existing API routes already implement idempotency (register checks erc8004_token_id, mint checks nft_contract, deploy checks token_address). The runner must replicate this pattern.
**Example:**
```typescript
// Skip registration if already registered
if (agent.erc8004_token_id) {
  log = addLogEntry(log, { action: 'register_identity', status: 'success', details: { skipped: true, existing: agent.erc8004_token_id } })
} else {
  // ... perform registration
}
```

### Pattern 4: Demo Scenario Data
**What:** Pre-defined content and bounties for each agent persona
**When to use:** To make the demo compelling with realistic content
**Example:**
```typescript
// src/lib/autonomous/demo-scenarios.ts
export const AGENT_SCENARIOS: Record<string, {
  posts: string[]
  bountyToCreate: { title: string; description: string; reward_amount: string; required_service_type: string }
  bountySearchType: string // what bounties this agent looks for
}> = {
  filmmaker: {
    posts: ['Just wrapped a cinematic short film about decentralized AI...'],
    bountyToCreate: { title: 'Create a promo video', description: '...', reward_amount: '300', required_service_type: 'filmmaker' },
    bountySearchType: 'filmmaker',
  },
  // ... other agents
}
```

### Anti-Patterns to Avoid
- **HTTP self-fetch in server scripts:** Base URL is unknown at build time; import functions directly
- **Parallel agent execution with shared wallet:** Nonce conflicts will cause transaction failures
- **Skipping error handling:** Each action must be try/caught independently so one failure doesn't abort the entire demo
- **Hardcoded agent IDs:** Query agents from DB by service_type, not by UUID

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent logging | Custom log format | Existing `buildAgentLog()` + `addLogEntry()` | Already structured correctly with timestamps |
| On-chain registration | New contract calls | Existing `registerAgent()` from erc8004.ts | Already handles ABI encoding, event parsing |
| Filecoin upload | New SDK wrapper | Existing `uploadToFilecoin()` from chain/filecoin.ts | Already handles PDP confirmation |
| NFT minting | New mint logic | Existing `mintPostNFT()` + `deployCollection()` from chain/nft.ts | Already handles collection auto-deploy |
| Token deployment | New Clanker calls | Existing `deployAgentToken()` from chain/clanker.ts | Already handles Clanker SDK v4 API |
| USDC payments | New transfer logic | Existing `transferUsdc()` from chain/usdc.ts | Already handles simulateContract + writeContract |

**Key insight:** Phase 8 should contain ZERO new chain/protocol code. Every on-chain action is already implemented. The only new code is the orchestration script that calls existing functions in the right order.

## Common Pitfalls

### Pitfall 1: Nonce Conflicts with Shared Operator Wallet
**What goes wrong:** Multiple agents try to send transactions simultaneously, causing nonce collisions
**Why it happens:** All agents share the same operator private key for chain interactions
**How to avoid:** Run agents sequentially, never in parallel. Add a small delay between on-chain transactions if needed.
**Warning signs:** "nonce too low" or "replacement transaction underpriced" errors

### Pitfall 2: Filecoin Upload Latency
**What goes wrong:** Upload takes 30+ seconds due to PDP proof confirmation; demo appears hung
**Why it happens:** `onPiecesConfirmed` waits for on-chain PDP verification
**How to avoid:** Log progress messages. Consider uploading agent logs as the final step. Accept that uploads are slow -- budget 1-2 minutes per agent for the full loop.
**Warning signs:** Timeout errors, no PieceCID returned

### Pitfall 3: Re-Running Demo Creates Duplicate Data
**What goes wrong:** Running the loop twice creates duplicate posts, duplicate bounties, duplicate NFT mints
**Why it happens:** Posts and bounties don't have natural idempotency keys (unlike registration which checks erc8004_token_id)
**How to avoid:** Add a "demo run" marker. Either: (a) check if demo posts already exist before creating, or (b) accept duplicates and clear+reseed before each demo run. Option (b) is simpler for hackathon.
**Warning signs:** Feed cluttered with duplicate content

### Pitfall 4: Bounty Claim Race Conditions
**What goes wrong:** Agent tries to claim a bounty that was just claimed by another agent in the same run
**Why it happens:** Sequential agents may target the same bounty
**How to avoid:** Query only `status = 'open'` bounties AND check the claim response status. Each agent should create its own bounty for others to claim, creating a natural marketplace.
**Warning signs:** 400 "Bounty is not open" errors

### Pitfall 5: Missing Environment Variables
**What goes wrong:** Chain modules throw cryptic errors
**Why it happens:** Missing FILECOIN_PRIVATE_KEY, AGENT_PAYMENT_ADDRESS, or other env vars
**How to avoid:** Validate all required env vars at runner startup before executing any actions
**Warning signs:** "env var is required" errors mid-run

### Pitfall 6: Token Deploy Rate Limit
**What goes wrong:** Clanker rejects token deployment
**Why it happens:** Clanker rate limits to 1 token per wallet per 24 hours
**How to avoid:** Token deployment should be a separate pre-demo step (deploy-all-tokens already exists). The autonomous loop should skip token deploy if token_address already exists.
**Warning signs:** 429 or Clanker SDK error

## Code Examples

### Agent Action: Discover and Claim Bounty
```typescript
// Source: existing bounty API patterns
async function discoverAndClaimBounty(
  agent: Agent,
  log: AgentLog,
): Promise<{ log: AgentLog; bountyId: string | null }> {
  const db = getDb()

  // Find open bounties matching agent's service type
  const bounty = db.prepare(
    `SELECT * FROM bounties WHERE status = 'open' AND required_service_type = ? AND creator_id != ? LIMIT 1`
  ).get(agent.service_type, agent.id) as Bounty | undefined

  if (!bounty) {
    log = addLogEntry(log, {
      action: 'discover_bounty',
      status: 'success',
      details: { found: false, serviceType: agent.service_type },
    })
    return { log, bountyId: null }
  }

  log = addLogEntry(log, {
    action: 'discover_bounty',
    status: 'success',
    details: { bountyId: bounty.id, title: bounty.title },
  })

  // Claim it
  db.prepare("UPDATE bounties SET status = 'claimed', claimed_by = ? WHERE id = ? AND status = 'open'")
    .run(agent.id, bounty.id)

  log = addLogEntry(log, {
    action: 'claim_bounty',
    status: 'success',
    details: { bountyId: bounty.id },
  })

  return { log, bountyId: bounty.id }
}
```

### Agent Action: Create Post
```typescript
async function createPost(
  agent: Agent,
  content: string,
  log: AgentLog,
): Promise<{ log: AgentLog; postId: string }> {
  const db = getDb()
  const postId = crypto.randomUUID()

  db.prepare(
    `INSERT INTO posts (id, agent_id, content, media_type) VALUES (?, ?, ?, ?)`
  ).run(postId, agent.id, content, 'text')

  log = addLogEntry(log, {
    action: 'create_post',
    status: 'success',
    details: { postId, contentPreview: content.slice(0, 80) },
  })

  return { log, postId }
}
```

### Full Runner Structure
```typescript
export async function runAutonomousLoop(): Promise<RunResult[]> {
  // Validate env vars upfront
  validateEnvironment()

  const db = getDb()
  const agents = db.prepare('SELECT * FROM agents').all() as Agent[]
  const results: RunResult[] = []

  for (const agent of agents) {
    let log = buildAgentLog(agent)
    const scenario = AGENT_SCENARIOS[agent.service_type || 'general']

    try {
      // 1. Register identity (idempotent)
      log = await registerIdentityAction(agent, log)

      // 2. Create bounty for others
      log = await createBountyAction(agent, scenario, log)

      // 3. Discover and claim a matching bounty
      const { log: updatedLog, bountyId } = await discoverAndClaimBounty(agent, log)
      log = updatedLog

      // 4. Create posts
      for (const content of scenario.posts) {
        const { log: postLog, postId } = await createPost(agent, content, log)
        log = postLog

        // 5. Mint first post as NFT
        log = await mintPostNFTAction(agent, postId, log)
      }

      // 6. Complete claimed bounty
      if (bountyId) {
        log = await completeBountyAction(agent, bountyId, log)
      }

      // 7. Upload final log to Filecoin
      const filResult = await uploadToFilecoin(log, `agent_log_${agent.id}.json`)
      log = addLogEntry(log, {
        action: 'upload_log',
        status: 'success',
        details: { pieceCid: filResult.pieceCid },
      })

      results.push({
        agentId: agent.id,
        agentName: agent.display_name,
        actions: log.logs.map(e => ({ action: e.action, status: e.status, details: e.details })),
        logFilecoinCid: filResult.pieceCid,
      })
    } catch (err) {
      log = addLogEntry(log, {
        action: 'runner_error',
        status: 'failure',
        details: { error: err instanceof Error ? err.message : String(err) },
      })
      // Still try to upload partial log
      try {
        const filResult = await uploadToFilecoin(log, `agent_log_${agent.id}.json`)
        results.push({ agentId: agent.id, agentName: agent.display_name, actions: log.logs.map(e => ({ action: e.action, status: e.status, details: e.details })), logFilecoinCid: filResult.pieceCid })
      } catch {
        results.push({ agentId: agent.id, agentName: agent.display_name, actions: log.logs.map(e => ({ action: e.action, status: e.status, details: e.details })), logFilecoinCid: null })
      }
    }
  }

  return results
}
```

### API Trigger Route
```typescript
// src/app/api/autonomous/run/route.ts
import { runAutonomousLoop } from '@/lib/autonomous/runner'

export async function POST(): Promise<Response> {
  try {
    const results = await runAutonomousLoop()
    return Response.json({ status: 'complete', results })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual API calls for demo | Scripted autonomous runner | Phase 8 | One-click demo execution |
| Separate log files | Structured AgentLog uploaded to Filecoin | Phase 3 | Verifiable execution history |

**Deprecated/outdated:**
- None -- this is a new orchestration layer

## Open Questions

1. **Demo video recording**
   - What we know: DEMO-04 requires a 2-minute video
   - What's unclear: Recording tool (screen capture, OBS, etc.) is outside code scope
   - Recommendation: Record after the autonomous loop runs successfully; script is not responsible for recording

2. **Token deployment timing**
   - What we know: Clanker rate limits 1 token/wallet/24h; deploy-all-tokens route exists
   - What's unclear: Whether tokens are already deployed from Phase 4 work
   - Recommendation: The runner should check token_address and skip deploy. Token deployment is a pre-requisite, not part of the autonomous loop itself.

3. **Bounty ecosystem bootstrap**
   - What we know: Seed data includes 4 bounties; the runner needs bounties to exist for agents to discover
   - What's unclear: Whether seed bounties are sufficient or if agents should create bounties for each other
   - Recommendation: Each agent creates a bounty as its first action, then discovers/claims bounties from other agents. This creates a natural marketplace flow for the demo.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-01 | Agent autonomously discovers bounties matching its service type | `discoverAndClaimBounty()` queries `bounties WHERE status='open' AND required_service_type = ?` |
| AUTO-02 | Agent plans content strategy and creates posts | `demo-scenarios.ts` provides per-persona post content; `createPost()` inserts to DB |
| AUTO-03 | Agent executes on-chain actions (register, mint NFTs, complete bounties) | Direct imports of `registerAgent()`, `mintPostNFT()`, `transferUsdc()` from existing chain modules |
| AUTO-04 | Agent verifies output quality and confirms on-chain transactions | Each action returns tx hashes; runner logs confirmation status |
| AUTO-05 | All agent decisions logged to agent_log.json with timestamps and tool calls | `addLogEntry()` from agent-log.ts records every action; final log uploaded to Filecoin |
| AUTO-06 | 3-5 diverse demo agents running | 5 seed agents (filmmaker, coder, trader, auditor, clipper) already in DB |
| DEMO-01 | On-chain ERC-8004 registrations viewable on BaseScan | Runner calls `registerAgent()` and logs txHash + BaseScan URL |
| DEMO-02 | On-chain token launches viewable on BaseScan | Token deployment is pre-requisite from Phase 4; runner logs existing token_address |
| DEMO-03 | On-chain NFT mints viewable on BaseScan | Runner calls `mintPostNFT()` and logs txHash |
| DEMO-04 | 2-minute demo video | Outside code scope -- manual screen recording after successful run |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/agent-card.ts`, `src/lib/agent-log.ts` -- agent card/log generators
- Codebase analysis: `src/lib/chain/erc8004.ts`, `src/lib/chain/clanker.ts`, `src/lib/chain/nft.ts`, `src/lib/chain/usdc.ts`, `src/lib/chain/filecoin.ts` -- all chain modules
- Codebase analysis: `src/app/api/bounties/route.ts`, `src/app/api/posts/route.ts` -- CRUD patterns
- Codebase analysis: `src/app/api/agents/[id]/register/route.ts` -- registration pattern with idempotency and log upload
- Codebase analysis: `src/app/api/chain/mint-nft/route.ts` -- mint pattern with auto-collection-deploy
- Codebase analysis: `src/app/api/bounties/[id]/complete/route.ts` -- completion with USDC payment
- Codebase analysis: `src/lib/seed.ts` -- 5 demo agents and seed bounties
- Codebase analysis: `src/lib/types.ts` -- Agent, Post, Bounty type definitions

### Secondary (MEDIUM confidence)
- STATE.md decisions on sequential token deployment, shared operator wallet

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all building blocks exist
- Architecture: HIGH -- straightforward orchestration of existing functions
- Pitfalls: HIGH -- based on direct analysis of existing chain module constraints (nonce, rate limits, Filecoin latency)

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- no external dependency changes expected)
