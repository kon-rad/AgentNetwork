# Phase 4: Clanker Tokens - Research

**Researched:** 2026-03-21
**Domain:** ERC-20 token deployment via Clanker SDK on Base
**Confidence:** MEDIUM

## Summary

Phase 4 deploys ERC-20 tokens for all 5 demo agents on Base using the Clanker SDK. Clanker is a token deployment protocol that creates ERC-20 tokens with automatic Uniswap V4 liquidity pool pairing in a single transaction. The SDK wraps viem wallet and public clients, which aligns perfectly with the project's existing viem-based chain module pattern (see `src/lib/chain/erc8004.ts`).

The project already has `token_address` and `token_symbol` columns in the agents table and `token_symbol` values in the seed data. The agent profile page already displays `$TOKEN_SYMBOL` and has a "Buy" button stub. This phase needs to: (1) create a Clanker chain module, (2) build an API route that deploys tokens and stores addresses in SQLite, (3) update the profile UI to link the Buy button to the Uniswap V4 pool and display the contract address.

**Primary recommendation:** Use `clanker-sdk` (npm) with viem clients on Base mainnet (chain 8453). Deploy tokens via the TypeScript SDK `deployToken()` method (not the REST API) to keep the same server-side viem pattern used for ERC-8004. Deploy all 5 tokens sequentially in a single session with error handling between each.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOK-01 | Each demo agent has an ERC-20 token launched via Clanker SDK on Base | Clanker SDK `deployToken()` creates ERC-20 + Uniswap V4 pool in one tx. Returns token address. |
| TOK-02 | Token info displayed on agent profile (symbol, address, trade link) | DB already has `token_address`/`token_symbol` columns. Profile page already renders `$TOKEN_SYMBOL`. Add contract address display + Uniswap link. |
| TOK-03 | "Buy Token" button links to Uniswap V4 pool for the agent's token | Uniswap URL format: `https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency={token_address}&chain=base` |
| TOK-04 | All 5 demo agent tokens deployed in a single session (respecting Clanker rate limits) | Sequential deployment with error handling. SDK handles on-chain tx directly -- no known rate limit for SDK-based deploys (rate limits apply to REST API with API key). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| clanker-sdk | latest | ERC-20 token deployment with Uniswap V4 pools | Official Clanker TypeScript SDK, uses viem clients (same as project) |
| viem | ^2.47.5 | Already installed -- wallet/public client for chain interactions | Project standard, used by ERC-8004 module |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-sqlite3 | ^12.8.0 | Already installed -- store token addresses | After deployment, update agents table |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| clanker-sdk (TypeScript) | REST API (POST /api/tokens/deploy/v4) | REST API requires API key from clanker.world + may require holding CLANKFUN tokens. SDK deploys directly on-chain via viem -- no API key needed. SDK preferred. |
| clanker-sdk | Direct smart contract calls | Would need to reverse-engineer Clanker factory ABI and Uniswap V4 pool setup. SDK wraps all of this. |

**Installation:**
```bash
pnpm add clanker-sdk
```

Note: `viem` is already installed as a dependency.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/chain/
  clanker.ts          # Clanker SDK wrapper (server-only, same pattern as erc8004.ts)
src/app/api/chain/
  deploy-token/
    route.ts          # POST endpoint: deploy token for an agent
  deploy-all-tokens/
    route.ts          # POST endpoint: deploy tokens for all 5 agents sequentially
src/components/profile/
  token-info.tsx      # Token display component for agent profile
```

### Pattern 1: Server-Side Chain Module (same as erc8004.ts)
**What:** A `server-only` module that wraps Clanker SDK with viem clients using `AGENT_PRIVATE_KEY` env var.
**When to use:** All token deployment operations.
**Example:**
```typescript
// src/lib/chain/clanker.ts
import 'server-only'
import { Clanker } from 'clanker-sdk'
import { createWalletClient, createPublicClient, http, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

function getClankerClient() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`
  if (!privateKey) throw new Error('AGENT_PRIVATE_KEY env var is required')

  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: base, transport: http() }) as PublicClient
  const wallet = createWalletClient({ account, chain: base, transport: http() })

  return new Clanker({ wallet, publicClient })
}

export async function deployAgentToken(
  name: string,
  symbol: string,
): Promise<{ tokenAddress: string }> {
  const clanker = getClankerClient()
  const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`)

  const tokenAddress = await clanker.deployToken({
    name,
    symbol,
    image: '', // optional -- can add IPFS image later
    metadata: { description: `Agent token for ${name}` },
    context: {
      interface: 'Network Platform',
      platform: 'Network',
      messageId: `deploy-${symbol}`,
      id: symbol,
    },
    pool: {
      quoteToken: '0x4200000000000000000000000000000000000006', // WETH on Base
      initialMarketCap: '1', // 1 WETH initial market cap
    },
    vault: { percentage: 0, durationInDays: 7 },
    devBuy: { ethAmount: 0 },
    rewardsConfig: {
      creatorReward: 100,
      creatorAdmin: account.address,
      creatorRewardRecipient: account.address,
      interfaceAdmin: account.address,
      interfaceRewardRecipient: account.address,
    },
  })

  return { tokenAddress }
}
```
Source: [Clanker SDK GitHub](https://github.com/clanker-devco/clanker-sdk), [Clanker SDK Docs](https://clanker.gitbook.io/clanker-documentation/sdk/v4.0.0)

### Pattern 2: Sequential Batch Deployment
**What:** Deploy all 5 agent tokens in a loop with error handling per token.
**When to use:** The "deploy all" endpoint -- called once to set up all demo tokens.
**Example:**
```typescript
// In the deploy-all-tokens route handler
const agents = db.prepare('SELECT id, display_name, token_symbol FROM agents WHERE token_address IS NULL').all()

const results = []
for (const agent of agents) {
  try {
    const { tokenAddress } = await deployAgentToken(
      `${agent.display_name} Token`,
      agent.token_symbol,
    )
    db.prepare('UPDATE agents SET token_address = ? WHERE id = ?').run(tokenAddress, agent.id)
    results.push({ agentId: agent.id, symbol: agent.token_symbol, tokenAddress, success: true })
  } catch (error) {
    results.push({ agentId: agent.id, symbol: agent.token_symbol, error: String(error), success: false })
  }
}
```

### Pattern 3: Uniswap V4 Swap Link
**What:** Generate a direct link to Uniswap swap page for the token.
**When to use:** "Buy Token" button on agent profile.
**Example:**
```typescript
function getUniswapSwapUrl(tokenAddress: string): string {
  return `https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${tokenAddress}&chain=base`
}
```
Source: [Uniswap Custom Linking Docs](https://docs.uniswap.org/contracts/v2/guides/interface-integration/custom-interface-linking)

### Anti-Patterns to Avoid
- **Deploying all tokens in parallel:** On-chain transactions from the same wallet must be sequential (nonce ordering). Parallel deploys will cause nonce conflicts.
- **Using the REST API when SDK works:** The REST API requires an API key and may require holding CLANKFUN tokens. The SDK deploys directly on-chain.
- **Re-deploying tokens for agents that already have one:** Always check `token_address IS NULL` before deploying. Token deployment is irreversible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ERC-20 + Uniswap V4 pool creation | Custom factory contract + pool init | clanker-sdk `deployToken()` | Handles ERC-20 deploy, Uniswap V4 pool creation, fee setup, and reward config in one tx |
| Token swap deep-linking | Custom swap UI | Uniswap app URL with `outputCurrency` param | Uniswap handles routing, slippage, wallet connection |
| WETH address on Base | Hardcoded or lookup | `0x4200000000000000000000000000000000000006` | Standard WETH address on Base (and all OP Stack L2s) |

## Common Pitfalls

### Pitfall 1: Base Mainnet vs Sepolia Mismatch
**What goes wrong:** ERC-8004 uses Base Sepolia but Clanker tokens should be on Base mainnet for real Uniswap pools.
**Why it happens:** Different chain configs across modules.
**How to avoid:** Use `base` (chain ID 8453) for Clanker, not `baseSepolia`. The clanker-sdk defaults to Base mainnet. Note: The existing erc8004.ts uses `baseSepolia` -- these are intentionally different chains. Clanker does not support Sepolia.
**Warning signs:** Token deploys fail with "unsupported chain" or pool links return 404 on Uniswap.

### Pitfall 2: Wallet Funding
**What goes wrong:** Token deployment transaction fails due to insufficient ETH for gas.
**Why it happens:** The `AGENT_PRIVATE_KEY` wallet needs ETH on Base mainnet for gas fees.
**How to avoid:** Verify wallet has ETH on Base mainnet before running deploy. Each token deploy costs approximately 0.001-0.01 ETH in gas. Budget ~0.05 ETH for all 5 tokens.
**Warning signs:** Transaction reverts with "insufficient funds."

### Pitfall 3: Nonce Conflicts in Sequential Deploys
**What goes wrong:** Second token deploy fails because the nonce from the first hasn't been confirmed yet.
**Why it happens:** viem may cache stale nonce if transactions are sent too quickly.
**How to avoid:** Await `deployToken()` fully (including transaction confirmation) before starting the next deploy. The SDK's `deployToken()` method should handle this by waiting for the receipt.
**Warning signs:** "nonce too low" or "replacement transaction underpriced" errors.

### Pitfall 4: SDK Constructor API Differences
**What goes wrong:** Import path or constructor differs between SDK versions.
**Why it happens:** The SDK docs show both `import { Clanker } from 'clanker-sdk'` and `import { Clanker } from 'clanker-sdk/v4'`. The GitHub README uses the top-level import.
**How to avoid:** Use `import { Clanker } from 'clanker-sdk'` (top-level import from README). If that fails, try `'clanker-sdk/v4'`. Check actual installed package exports.
**Warning signs:** Import errors at build time.

### Pitfall 5: rewardsConfig is Required
**What goes wrong:** Deploy fails with validation error.
**Why it happens:** The Clanker v4 protocol requires at least one reward recipient with allocations totaling 100%.
**How to avoid:** Always include `rewardsConfig` with allocations. For a hackathon demo, set the deployer wallet as both creator and interface reward recipient with 100% to creator.
**Warning signs:** Validation error mentioning rewards or allocation.

## Code Examples

### Token Deployment with Full Error Handling
```typescript
// Source: Clanker SDK GitHub README + official docs
import { Clanker } from 'clanker-sdk'
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const WETH_BASE = '0x4200000000000000000000000000000000000006'

export async function deployToken(name: string, symbol: string) {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  }) as PublicClient

  const wallet = createWalletClient({
    account,
    chain: base,
    transport: http(),
  })

  const clanker = new Clanker({ wallet, publicClient })

  const tokenAddress = await clanker.deployToken({
    name,
    symbol,
    image: '',
    metadata: { description: `${name} - Agent token on Network` },
    context: {
      interface: 'Network',
      platform: 'Network',
      messageId: `deploy-${symbol}-${Date.now()}`,
      id: symbol,
    },
    pool: {
      quoteToken: WETH_BASE,
      initialMarketCap: '1',
    },
    vault: { percentage: 0, durationInDays: 7 },
    devBuy: { ethAmount: 0 },
    rewardsConfig: {
      creatorReward: 100,
      creatorAdmin: account.address,
      creatorRewardRecipient: account.address,
      interfaceAdmin: account.address,
      interfaceRewardRecipient: account.address,
    },
  })

  return tokenAddress // hex string: 0x...
}
```

### Uniswap Buy Link Generation
```typescript
// Source: Uniswap custom linking docs
const UNISWAP_SWAP_BASE = 'https://app.uniswap.org/swap'

export function getTokenSwapUrl(tokenAddress: string): string {
  return `${UNISWAP_SWAP_BASE}?inputCurrency=ETH&outputCurrency=${tokenAddress}&chain=base`
}

export function getBaseScanTokenUrl(tokenAddress: string): string {
  return `https://basescan.org/token/${tokenAddress}`
}
```

### DB Update After Deploy
```typescript
// Update agent record with deployed token address
db.prepare('UPDATE agents SET token_address = ?, updated_at = datetime(\'now\') WHERE id = ?')
  .run(tokenAddress, agentId)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Clanker v3 (direct Farcaster tagging) | Clanker v4 SDK (programmatic deploy) | Late 2025 | SDK enables server-side deployment without Farcaster |
| Manual ERC-20 deploy + pool create | Single-tx deploy via Clanker factory | Clanker v4 | One transaction creates token + pool + fee config |
| Uniswap V3 pools | Uniswap V4 pools | 2025 | Clanker v4 creates V4 pools by default on Base |

## Open Questions

1. **SDK Import Path**
   - What we know: README shows `import { Clanker } from 'clanker-sdk'`, docs show `'clanker-sdk/v4'`
   - What's unclear: Which import path works with latest npm version
   - Recommendation: Try top-level import first, fall back to `/v4` subpath

2. **CLANKFUN Token Requirement**
   - What we know: The REST API docs mention needing 1,000,000 CLANKFUN tokens to launch
   - What's unclear: Whether this applies to SDK-based on-chain deploys or only the REST API
   - Recommendation: The SDK deploys directly on-chain via the factory contract. This requirement likely only applies to the REST API. If SDK deploy fails, fall back to REST API with an API key.

3. **deployToken Return Type**
   - What we know: GitHub README says it returns `string` (token address). SDK v4 docs show `{ txHash, waitForTransaction, error }` pattern.
   - What's unclear: The actual return type may differ between README and current version
   - Recommendation: Handle both patterns -- check if result is a string or an object with `txHash`/`waitForTransaction`

4. **Base Mainnet ETH Funding**
   - What we know: AGENT_PRIVATE_KEY wallet needs ETH on Base mainnet for gas
   - What's unclear: Exact gas cost per token deploy
   - Recommendation: Fund wallet with at least 0.05 ETH on Base mainnet before running deploy-all

## Sources

### Primary (HIGH confidence)
- [Clanker SDK GitHub README](https://github.com/clanker-devco/clanker-sdk) -- installation, constructor, deployToken() method, full example
- [Clanker SDK v4.0.0 Docs](https://clanker.gitbook.io/clanker-documentation/sdk/v4.0.0) -- constructor params, deploy config, return types
- [Clanker REST API v4 Docs](https://clanker.gitbook.io/clanker-documentation/authenticated/deploy-token-v4.0.0) -- API endpoint, request/response format, rewards config
- [Uniswap Custom Linking](https://docs.uniswap.org/contracts/v2/guides/interface-integration/custom-interface-linking) -- swap URL format

### Secondary (MEDIUM confidence)
- [Base Token Launch Docs](https://docs.base.org/get-started/launch-token) -- Clanker overview on Base
- [clanker-sdk npm](https://www.npmjs.com/package/clanker-sdk) -- package availability confirmed

### Tertiary (LOW confidence)
- Rate limit of "1 token per wallet per 24h" mentioned in STATE.md (from project init) -- could not verify in official docs; may be outdated or only apply to Farcaster-based launches, not SDK deploys

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- clanker-sdk is the official SDK, well-documented
- Architecture: HIGH -- follows exact same pattern as erc8004.ts (server-only viem module)
- Pitfalls: MEDIUM -- SDK return type ambiguity and CLANKFUN requirement need runtime verification
- Code examples: MEDIUM -- based on docs/README but not runtime-tested; import path and return type may differ

**Research date:** 2026-03-21
**Valid until:** 2026-04-07 (14 days -- Clanker SDK is actively developed)
