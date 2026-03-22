# Phase 3: ERC-8004 Identity - Research

**Researched:** 2026-03-21
**Domain:** ERC-8004 on-chain agent identity (IdentityRegistry + ReputationRegistry on Base Sepolia)
**Confidence:** HIGH

## Summary

ERC-8004 is an Ethereum standard (live on mainnet since Jan 29, 2026) that provides AI agents with on-chain identity via three registries: Identity (ERC-721), Reputation (feedback signals), and Validation (verifier hooks). The standard has official deployments on Base Sepolia with known contract addresses. This phase needs to: (1) generate agent.json manifests conforming to the ERC-8004 registration-v1 schema, (2) upload them to Filecoin via the existing Phase 2 infrastructure, (3) call `register(string agentURI)` on the IdentityRegistry to mint an ERC-721 NFT per agent, (4) generate agent_log.json structured execution logs, (5) call `giveFeedback()` on the ReputationRegistry, and (6) display registration status + BaseScan links on agent profiles.

The project already has viem v2.47.5 and a server-side wallet client pattern (see `src/lib/chain/filecoin.ts`). There is no viable npm SDK for ERC-8004 -- use viem direct contract calls with hardcoded ABIs extracted from the EIP spec. The existing `erc8004_token_id` column in the agents table is ready for storing the minted token ID.

**Primary recommendation:** Create a server-only `src/lib/chain/erc8004.ts` module mirroring the filecoin.ts pattern -- viem wallet client with `AGENT_PRIVATE_KEY` env var, hardcoded ABI fragments for IdentityRegistry and ReputationRegistry, and functions for register + giveFeedback. Use the existing Filecoin upload API to pin agent.json before registration.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ID-01 | Agent can register on-chain identity via ERC-8004 IdentityRegistry on Base Sepolia | IdentityRegistry at `0x8004A818BFB912233c491871b3d84c89A494BD9e` on Base Sepolia; `register(string agentURI)` function returns `uint256 agentId` |
| ID-02 | Registration mints ERC-721 NFT with agentURI pointing to Filecoin-stored agent card JSON | IdentityRegistry extends ERC-721URIStorage; agentURI can be `https://cdn.filecoin.cloud/{pieceCid}` from existing Filecoin upload |
| ID-03 | Agent profile page shows ERC-8004 registration status and BaseScan link | BaseScan URL format: `https://sepolia.basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a={tokenId}` |
| ID-04 | agent.json manifest generated per agent (name, operator wallet, ERC-8004 identity, tools, task categories) | ERC-8004 registration-v1 schema documented; fields: type, name, description, image, services[], supportedTrust[], active |
| ID-05 | agent_log.json structured execution logs generated per agent | Structured log format with decisions, tool calls, retries, failures, outputs; uploaded to Filecoin as `agent_log` type |
| ID-06 | ERC-8004 Reputation Registry used to record agent feedback/ratings | ReputationRegistry at `0x8004B663056A597Dffe9eCcC1965A193B7388713`; `giveFeedback()` function with value, tags, feedbackURI |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | ^2.47.5 | Smart contract interaction (read/write) | Already in project; direct ABI-typed contract calls |
| wagmi | ^2.19.5 | Client-side contract reads (profile display) | Already in project; useReadContract for registration status |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @filoz/synapse-sdk | ^0.40.0 | Upload agent.json + agent_log.json to Filecoin | Already in project; Phase 2 infrastructure |
| better-sqlite3 | ^12.8.0 | Store token IDs, registration tx hashes | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| viem direct calls | ethers.js | ethers already in package.json but viem is the established pattern for this project; consistency wins |
| Hardcoded ABI | npm package | No official ERC-8004 npm package exists; hardcoded ABI fragments from the EIP spec are the only viable path |

**Installation:**
```bash
# No new packages needed -- viem, wagmi, filecoin SDK are already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    chain/
      filecoin.ts          # (exists) Filecoin upload/download
      erc8004.ts           # NEW: IdentityRegistry + ReputationRegistry calls
    agent-card.ts          # NEW: Generate agent.json per ERC-8004 registration-v1 schema
    agent-log.ts           # NEW: Generate agent_log.json structured logs
  app/
    api/
      agents/[id]/
        register/route.ts  # NEW: POST — orchestrate agent.json upload + on-chain register
        feedback/route.ts  # NEW: POST — submit reputation feedback
      chain/
        upload/route.ts    # (exists) Filecoin upload
  components/
    profile/
      erc8004-status.tsx   # NEW: Registration status badge + BaseScan link
      reputation-card.tsx  # NEW: Reputation feedback display
```

### Pattern 1: Server-Side Contract Interaction (matching filecoin.ts)
**What:** Server-only module with viem walletClient for write operations
**When to use:** All on-chain write operations (register, giveFeedback)
**Example:**
```typescript
// src/lib/chain/erc8004.ts
import 'server-only'
import { createWalletClient, createPublicClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const
const REPUTATION_REGISTRY = '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const

// Minimal ABI fragments — only functions we actually call
const identityRegistryAbi = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const reputationRegistryAbi = [
  {
    name: 'giveFeedback',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'getSummary',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'value', type: 'int128' },
      { name: 'decimals', type: 'uint8' },
    ],
  },
] as const

function getWalletClient() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as Hex
  if (!privateKey) throw new Error('AGENT_PRIVATE_KEY env var is required')
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({ account, chain: baseSepolia, transport: http() })
}

function getPublicClient() {
  return createPublicClient({ chain: baseSepolia, transport: http() })
}

export async function registerAgent(agentURI: string): Promise<{ agentId: bigint; txHash: string }> {
  const wallet = getWalletClient()
  const txHash = await wallet.writeContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'register',
    args: [agentURI],
  })
  // Wait for receipt to get token ID from Registered event
  const publicClient = getPublicClient()
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  // Parse Registered event to extract agentId
  // Event: Registered(uint256 indexed agentId, string agentURI, address indexed owner)
  const agentId = BigInt(receipt.logs[0]?.topics[1] ?? '0')
  return { agentId, txHash }
}
```

### Pattern 2: Agent Card JSON Generation (ERC-8004 registration-v1)
**What:** Build agent.json conforming to the ERC-8004 registration file schema
**When to use:** Before registering an agent on-chain
**Example:**
```typescript
// src/lib/agent-card.ts
import type { Agent } from '@/lib/types'

export function buildAgentCard(agent: Agent) {
  const services = agent.services_offered ? JSON.parse(agent.services_offered) : []
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.display_name,
    description: agent.bio || '',
    image: agent.avatar_url || '',
    services: [
      {
        name: 'Network Agent Services',
        endpoint: `https://network.example.com/api/agents/${agent.id}`,
        version: '1.0.0',
        skills: services,
        domains: [agent.service_type || 'general'],
      },
    ],
    x402Support: false,
    active: true,
    registrations: [],
    supportedTrust: ['reputation'],
  }
}
```

### Pattern 3: Idempotent Registration Flow
**What:** Check if agent already has erc8004_token_id before registering; skip if already done
**When to use:** Registration API route — prevents double-registering
**Example:**
```typescript
// In register route handler:
// 1. Check agent.erc8004_token_id — if set, return existing registration
// 2. Generate agent.json via buildAgentCard()
// 3. Upload to Filecoin via POST /api/chain/upload (type: 'agent_card')
// 4. Call registerAgent(filecoinRetrievalUrl) — get back agentId + txHash
// 5. UPDATE agents SET erc8004_token_id = ? WHERE id = ?
// 6. Return { agentId, txHash, basescanUrl }
```

### Anti-Patterns to Avoid
- **Calling register() without checking existing registration:** IdentityRegistry mints a new NFT per call. Always check `erc8004_token_id` first.
- **Using IPFS gateway URLs as agentURI:** The project uses Filecoin Onchain Cloud (cdn.filecoin.cloud), not IPFS. Use the `retrievalUrl` from the Filecoin upload result.
- **Blocking the UI on transaction confirmation:** Registration may take 10-30 seconds. Show a pending state and poll/wait for receipt.
- **Importing ethers alongside viem:** The project has ethers installed but uses viem exclusively for contract interactions. Do not mix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ABI encoding/decoding | Manual hex parsing | viem `writeContract` / `readContract` | viem handles ABI encoding, gas estimation, nonce management |
| Transaction receipt parsing | Manual log decoding | viem `waitForTransactionReceipt` + `decodeEventLog` | Event parsing is error-prone; viem handles indexed topics |
| Agent card schema | Custom JSON format | ERC-8004 registration-v1 schema | Must conform to standard for ecosystem compatibility |
| BaseScan URL construction | Hardcoded string templates | Well-known pattern: `https://sepolia.basescan.org/tx/{hash}` | Simple but must use correct subdomain (sepolia vs mainnet) |

## Common Pitfalls

### Pitfall 1: Wrong Contract Address (Sepolia vs Mainnet)
**What goes wrong:** Using mainnet contract address on testnet (or vice versa)
**Why it happens:** ERC-8004 has distinct addresses per network
**How to avoid:** Use env var or constant clearly labeled. Base Sepolia IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`, NOT the mainnet address `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
**Warning signs:** Transaction reverts with no clear error

### Pitfall 2: Insufficient Gas / No ETH on Base Sepolia
**What goes wrong:** Registration transaction fails because wallet has no Base Sepolia ETH
**Why it happens:** Testnet wallets need faucet funds
**How to avoid:** Document faucet requirement in setup. Base Sepolia faucet: https://www.alchemy.com/faucets/base-sepolia
**Warning signs:** Transaction reverts with "insufficient funds"

### Pitfall 3: Parsing agentId from Transaction Receipt
**What goes wrong:** `register()` returns `uint256 agentId` but viem writeContract only returns txHash
**Why it happens:** Write calls don't return values; must parse from event logs
**How to avoid:** Use `waitForTransactionReceipt` then parse the `Registered` event from logs. The agentId is the first indexed topic.
**Warning signs:** agentId is always 0 or undefined

### Pitfall 4: Double Registration
**What goes wrong:** Agent gets multiple NFTs on the IdentityRegistry
**Why it happens:** No idempotency check before calling register()
**How to avoid:** Always check `agent.erc8004_token_id` in the DB before registering. If set, return the existing registration.
**Warning signs:** Multiple Registered events for the same agent wallet

### Pitfall 5: agentURI Format
**What goes wrong:** Using a pieceCid directly instead of a full URL
**Why it happens:** Filecoin upload returns both pieceCid and retrievalUrl
**How to avoid:** Pass the full `retrievalUrl` (e.g., `https://cdn.filecoin.cloud/{pieceCid}`) as the agentURI, not just the CID
**Warning signs:** Agent card not resolvable from tokenURI

### Pitfall 6: ReputationRegistry giveFeedback Requires Registered agentId
**What goes wrong:** Calling giveFeedback with the wrong agentId type (DB string vs on-chain uint256)
**Why it happens:** The DB stores erc8004_token_id as TEXT; the contract expects uint256
**How to avoid:** Convert with `BigInt(agent.erc8004_token_id)` before passing to contract call
**Warning signs:** Transaction reverts

## Code Examples

### Agent Registration File (agent.json)
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "CinematicAI",
  "description": "Autonomous AI filmmaker. I create short films, cinematic clips, and visual stories.",
  "image": "/avatars/filmmaker.png",
  "services": [
    {
      "name": "Network Agent Services",
      "endpoint": "https://network.example.com/api/agents/{id}",
      "version": "1.0.0",
      "skills": ["short films", "video clips", "motion graphics", "trailers"],
      "domains": ["filmmaker"]
    }
  ],
  "x402Support": false,
  "active": true,
  "registrations": [],
  "supportedTrust": ["reputation"]
}
```

### Agent Execution Log (agent_log.json)
```json
{
  "agentId": "uuid-from-db",
  "erc8004Id": 42,
  "agentName": "CinematicAI",
  "logs": [
    {
      "timestamp": "2026-03-21T12:00:00Z",
      "action": "register_identity",
      "status": "success",
      "details": {
        "txHash": "0xabc...",
        "agentId": 42,
        "agentURI": "https://cdn.filecoin.cloud/baga..."
      }
    },
    {
      "timestamp": "2026-03-21T12:05:00Z",
      "action": "receive_feedback",
      "status": "success",
      "details": {
        "from": "0x222...",
        "value": 5,
        "tag1": "quality",
        "tag2": "filmmaker"
      }
    }
  ]
}
```

### Reputation Feedback Submission
```typescript
// Source: ERC-8004 EIP spec — giveFeedback function
export async function submitFeedback(
  agentId: bigint,
  value: number,     // e.g., 5 for 5-star
  tag1: string,      // e.g., "quality"
  tag2: string,      // e.g., "filmmaker"
) {
  const wallet = getWalletClient()
  const txHash = await wallet.writeContract({
    address: REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'giveFeedback',
    args: [
      agentId,
      BigInt(value),      // int128 value
      0,                   // uint8 valueDecimals (0 = integer rating)
      tag1,
      tag2,
      '',                  // endpoint (empty for general feedback)
      '',                  // feedbackURI (empty if no off-chain details)
      '0x' + '0'.repeat(64) as `0x${string}`,  // feedbackHash (zero for now)
    ],
  })
  return txHash
}
```

### Client-Side Registration Status Display
```typescript
// Using wagmi useReadContract to check registration on client
import { useReadContract } from 'wagmi'
import { baseSepolia } from 'viem/chains'

const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'

function useAgentRegistrationStatus(tokenId: string | null) {
  const { data: tokenURI } = useReadContract({
    address: IDENTITY_REGISTRY,
    abi: [{ name: 'tokenURI', type: 'function', stateMutability: 'view',
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            outputs: [{ name: '', type: 'string' }] }],
    functionName: 'tokenURI',
    args: tokenId ? [BigInt(tokenId)] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!tokenId },
  })
  return { tokenURI, isRegistered: !!tokenId }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No standard agent identity | ERC-8004 IdentityRegistry (ERC-721) | Jan 2026 mainnet | Agents get portable, transferable on-chain IDs |
| Custom reputation systems | ERC-8004 ReputationRegistry | Jan 2026 mainnet | Standardized feedback format across ecosystem |
| IPFS-only agent card storage | Filecoin Onchain Cloud + Filecoin Pin | 2025-2026 | PDP-proven persistent storage with CDN retrieval |

**Deprecated/outdated:**
- Custom agent registry contracts: Use the official ERC-8004 IdentityRegistry deployments
- IPFS pinning for agent cards: Use Filecoin Onchain Cloud (already implemented in Phase 2)

## Open Questions

1. **Base Sepolia ETH funding**
   - What we know: Registration requires gas on Base Sepolia
   - What's unclear: Whether the AGENT_PRIVATE_KEY wallet is already funded
   - Recommendation: Add a check/warning in the register route; document faucet URL in env setup

2. **Event log parsing for agentId**
   - What we know: `register()` emits `Registered(uint256 indexed agentId, string agentURI, address indexed owner)`
   - What's unclear: Exact log index position in receipt (depends on whether Transfer event fires first from ERC-721)
   - Recommendation: Parse logs by matching the Registered event signature, not by index position. Use viem `decodeEventLog`.

3. **Same private key for Filecoin and Base Sepolia?**
   - What we know: `FILECOIN_PRIVATE_KEY` is used for Filecoin uploads; Base Sepolia needs a key too
   - What's unclear: Whether same key should be reused or separate
   - Recommendation: Use separate env var `AGENT_PRIVATE_KEY` for Base Sepolia to allow different funding sources; can be same key if convenient

## Sources

### Primary (HIGH confidence)
- [EIP-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004) - Full interface definitions, registration file schema, reputation registry API
- [erc-8004/erc-8004-contracts GitHub](https://github.com/erc-8004/erc-8004-contracts) - Official contract addresses: Base Sepolia IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, ReputationRegistry `0x8004B663056A597Dffe9eCcC1965A193B7388713`

### Secondary (MEDIUM confidence)
- [DEV.to: Making Services Discoverable with ERC-8004](https://dev.to/hammertoe/making-services-discoverable-with-erc-8004-trustless-agent-registration-with-filecoin-pin-1al3) - Practical registration walkthrough with Filecoin Pin, cast command examples
- [Composable Security: ERC-8004 Practical Explainer](https://composable-security.com/blog/erc-8004-a-practical-explainer-for-trustless-agents/) - Registry architecture overview

### Tertiary (LOW confidence)
- [QuickNode: ERC-8004 Developer Guide](https://blog.quicknode.com/erc-8004-a-developers-guide-to-trustless-ai-agent-identity/) - High-level overview, no code examples (LOW: no implementation details)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - viem + existing project patterns; no new dependencies needed
- Architecture: HIGH - Follows established filecoin.ts pattern; contract addresses verified from official repo
- Pitfalls: HIGH - Well-documented standard with clear interface; main risks are operational (gas, idempotency)
- Contract addresses: HIGH - Verified from official erc-8004-contracts GitHub repository
- Registration schema: HIGH - Directly from EIP spec
- ReputationRegistry usage: MEDIUM - Interface is clear from spec; exact parameter values for our use case need validation

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- ERC-8004 is a finalized standard with fixed contract addresses)
