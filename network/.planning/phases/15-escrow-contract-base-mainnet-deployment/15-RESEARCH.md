# Phase 15: Escrow Contract & Base Mainnet Deployment - Research

**Researched:** 2026-03-22
**Domain:** Solidity smart contract compilation, deployment, and TypeScript integration on Base mainnet
**Confidence:** HIGH

## Summary

Phase 15 deploys an already-drafted AgentEscrow Solidity contract to Base mainnet and wires up API routes for the full job lifecycle (create/release/dispute/resolve/refund). The contract source (`contracts/AgentEscrow.sol`) and TypeScript client (`src/lib/chain/escrow.ts`) already exist but target Base Sepolia. The deploy script (`scripts/deploy-escrow.ts`) also targets Sepolia. All three files need mainnet updates.

The key technical challenge is compiling Solidity with OpenZeppelin imports using solc (no Hardhat/Foundry). OpenZeppelin `@openzeppelin/contracts` is NOT currently installed in the project and must be added. The `solc` npm package (solc-js) provides a pure JavaScript compiler that can handle standard JSON input with import callbacks, avoiding the need for a system-installed `solc` binary (which is also not present on the dev machine).

**Primary recommendation:** Install `@openzeppelin/contracts` (v5.x) and `solc` (npm), update the deploy script to use solc-js with an import callback for node_modules resolution, switch all chain references from `baseSepolia` to `base`, and use the confirmed Base mainnet USDC address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | ^2.47.5 | Chain interaction, contract deployment, tx signing | Already used across all chain modules in project |
| @openzeppelin/contracts | ^5.4.0 | SafeERC20, IERC20 imports for escrow contract | Industry standard; contract already imports from it |
| solc | ^0.8.28 (npm) | Compile Solidity to ABI + bytecode in Node.js | Pure JS, no system binary needed; supports standard JSON |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | (already installed) | Run deploy script as TypeScript | `npx tsx scripts/deploy-escrow.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| solc npm package | System solc binary (`brew install solidity`) | System binary not installed; npm package is portable and CI-friendly |
| solc-js | Hardhat/Foundry | Decision already locked: no Hardhat/Foundry; solc+viem approach |

**Installation:**
```bash
npm install @openzeppelin/contracts solc
```

Note: `@openzeppelin/contracts` is a Solidity-only package (no JS runtime). `solc` is the JS binding for the Solidity compiler.

## Architecture Patterns

### Recommended Project Structure
```
contracts/
  AgentEscrow.sol          # Solidity source (already exists)
scripts/
  deploy-escrow.ts         # Deploy script (update: baseSepolia -> base)
src/lib/chain/
  escrow.ts                # TypeScript client (update: baseSepolia -> base)
  abi/
    AgentEscrow.json        # Generated ABI (output of compilation)
src/app/api/escrow/
  route.ts                  # POST create job, GET job status
  [jobId]/
    release/route.ts         # POST release funds
    dispute/route.ts         # POST raise dispute
    resolve/route.ts         # POST resolve dispute (treasury only)
    refund/route.ts          # POST refund (treasury only)
```

### Pattern 1: solc-js Compilation with Import Callback
**What:** Use the `solc` npm package's `compile` function with an `importCallback` to resolve `@openzeppelin/` imports from `node_modules`.
**When to use:** When compiling Solidity that imports from npm packages without Hardhat/Foundry.
**Example:**
```typescript
// Source: https://www.npmjs.com/package/solc + OpenZeppelin forum
import solc from 'solc'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const input = {
  language: 'Solidity',
  sources: {
    'AgentEscrow.sol': {
      content: readFileSync(resolve(__dirname, '../contracts/AgentEscrow.sol'), 'utf8'),
    },
  },
  settings: {
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    optimizer: { enabled: true, runs: 200 },
  },
}

function findImports(importPath: string) {
  try {
    const resolved = resolve(__dirname, '../node_modules', importPath)
    return { contents: readFileSync(resolved, 'utf8') }
  } catch {
    return { error: `File not found: ${importPath}` }
  }
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }))
const contract = output.contracts['AgentEscrow.sol']['AgentEscrow']
const abi = contract.abi
const bytecode = `0x${contract.evm.bytecode.object}`
```

### Pattern 2: Chain Selection (baseSepolia -> base)
**What:** All existing chain modules use `baseSepolia` except `clanker.ts` and `subscriptions/route.ts` which already use `base` (mainnet). Escrow must follow the mainnet pattern.
**When to use:** Updating escrow.ts and deploy-escrow.ts.
**Example:**
```typescript
// Change from:
import { baseSepolia } from 'viem/chains'
// To:
import { base } from 'viem/chains'

// Update publicClient and walletClient chain parameter
const publicClient = createPublicClient({ chain: base, transport: http() })
```

### Pattern 3: API Route Pattern (from subscriptions/route.ts)
**What:** API routes use `requireAuth()` for session checking, `supabaseAdmin` for DB, and `createPublicClient` with `base` chain for on-chain verification.
**When to use:** All escrow API routes.
**Example:**
```typescript
import { requireAuth } from '@/lib/auth/guard'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({ chain: base, transport: http() })

export async function POST(req: NextRequest) {
  const sessionOrError = await requireAuth()
  if (sessionOrError instanceof Response) return sessionOrError
  const session = sessionOrError
  // ... route logic
}
```

### Anti-Patterns to Avoid
- **Using system solc binary:** The dev machine does not have it installed. Use the `solc` npm package instead.
- **Keeping baseSepolia references:** All escrow code must use `base` (mainnet). Do not leave any testnet references.
- **Hardcoded private keys in escrow.ts:** The existing code correctly uses env vars for `TREASURY_PRIVATE_KEY` and `ESCROW_DEPLOYER_PRIVATE_KEY`. Keep this pattern.
- **Client-side private key handling for createJob:** The current escrow.ts takes `clientPrivateKey` as a parameter. For API routes that create jobs on behalf of users, the client signs the approval+createJob transactions in their browser wallet (via wagmi), then the API route verifies the on-chain state. Do NOT have the server hold client private keys.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ERC20 safe transfers | Custom transfer logic | OpenZeppelin SafeERC20 | Handles non-standard return values, reverts on failure |
| Solidity compilation | Shell exec of solc binary | `solc` npm package with import callback | Portable, no system dependency, CI-friendly |
| ABI encoding/decoding | Manual hex parsing | viem's built-in ABI support | Type-safe, handles all Solidity types correctly |
| Event log parsing | Manual topic parsing | viem `decodeEventLog` | The existing escrow.ts has a fragile log parser that should use `decodeEventLog` like erc8004.ts does |

**Key insight:** The existing `createJob` function in escrow.ts parses the `JobCreated` event by manually reading `logs[0].topics[1]` which is fragile. Use viem's `decodeEventLog` pattern from erc8004.ts instead.

## Common Pitfalls

### Pitfall 1: solc-js Import Resolution Failure
**What goes wrong:** `solc` cannot find `@openzeppelin/contracts/token/ERC20/IERC20.sol` during compilation.
**Why it happens:** The `solc` npm package does not automatically resolve imports from `node_modules`. You must provide an `importCallback` (also called `findImports`).
**How to avoid:** Always pass the `{ import: findImports }` callback to `solc.compile()` that reads from `node_modules`.
**Warning signs:** Compilation errors mentioning "Source not found" or "File not found".

### Pitfall 2: USDC Decimals (6 not 18)
**What goes wrong:** Amounts are 10^12x too large or too small.
**Why it happens:** USDC uses 6 decimals, not 18 like ETH. The contract deals in raw uint256 amounts.
**How to avoid:** Always use `parseUnits(amount, 6)` when converting human-readable USDC to on-chain values. The existing code already does this correctly via `USDC_DECIMALS = 6`.
**Warning signs:** Transaction reverts due to insufficient balance when the user clearly has enough USDC.

### Pitfall 3: Missing USDC Approval Before createJob
**What goes wrong:** `createJob` reverts with "ERC20: insufficient allowance".
**Why it happens:** The escrow contract uses `safeTransferFrom` which requires the client to first `approve` the escrow contract to spend their USDC.
**How to avoid:** The client must call `usdc.approve(escrowAddress, amount)` before calling `escrow.createJob()`. The API flow should be: (1) client approves in wallet, (2) client calls createJob in wallet, (3) API verifies the on-chain job creation.
**Warning signs:** First-time users always fail if approval step is skipped.

### Pitfall 4: Fragile Event Log Parsing
**What goes wrong:** `createJob` returns `jobId = 0n` even for the second+ job.
**Why it happens:** The current code does `receipt.logs[0]?.topics[1]` which assumes the JobCreated event is always the first log. USDC Transfer events may appear first.
**How to avoid:** Use `decodeEventLog` with the full escrow ABI to find the `JobCreated` event by signature, iterating all logs (same pattern as `erc8004.ts`).
**Warning signs:** Wrong jobId returned, especially when multiple events are emitted.

### Pitfall 5: Mainnet ETH for Gas
**What goes wrong:** Deployment or transactions fail with "insufficient funds".
**Why it happens:** The deployer wallet needs real ETH on Base mainnet to pay for gas.
**How to avoid:** Fund the deployer wallet (`0x6573F68F85b89727F8Ba9083fBc900Ec135653a1`) with Base mainnet ETH before running the deploy script. Contract deployment typically costs ~$0.50-2.00 on Base.
**Warning signs:** Transaction submission fails immediately.

### Pitfall 6: Client-Side vs Server-Side Transaction Flow
**What goes wrong:** Server tries to sign transactions with client's private key.
**Why it happens:** The existing escrow.ts functions take `clientPrivateKey` as a parameter, designed for server-side use.
**How to avoid:** For the API route pattern, the client signs transactions in their browser wallet (via wagmi/viem). The API route then verifies the on-chain state (job exists, correct status). Server-side signing is only for treasury operations (resolveDispute, refundJob).
**Warning signs:** API route expects private keys in request body.

## Code Examples

### Verified: viem deployContract on Base Mainnet
```typescript
// Source: existing deploy-escrow.ts pattern + viem docs
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'  // <-- mainnet, not baseSepolia

const account = privateKeyToAccount(DEPLOYER_KEY)
const walletClient = createWalletClient({ account, chain: base, transport: http() })
const publicClient = createPublicClient({ chain: base, transport: http() })

const hash = await walletClient.deployContract({
  abi,
  bytecode,
  args: [
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base mainnet USDC
    '0x0eEf9b6C1f35266A2440E0263C5B89AcaDd12d72', // Treasury wallet
  ],
})

const receipt = await publicClient.waitForTransactionReceipt({ hash })
console.log(`Escrow deployed at: ${receipt.contractAddress}`)
console.log(`BaseScan: https://basescan.org/address/${receipt.contractAddress}`)
```

### Verified: Proper Event Log Parsing with decodeEventLog
```typescript
// Source: existing erc8004.ts pattern
import { decodeEventLog } from 'viem'

const jobCreatedAbi = [
  {
    name: 'JobCreated',
    type: 'event',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true },
      { name: 'client', type: 'address', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

// In createJob after getting receipt:
let jobId: bigint | undefined
for (const log of receipt.logs) {
  try {
    const decoded = decodeEventLog({
      abi: jobCreatedAbi,
      data: log.data,
      topics: log.topics,
    })
    if (decoded.eventName === 'JobCreated') {
      jobId = decoded.args.jobId
      break
    }
  } catch {
    // Not a JobCreated event -- skip
  }
}
```

### API Route: Verify On-Chain Job Creation
```typescript
// Pattern: client signs tx in wallet, sends tx_hash to API for verification
export async function POST(req: NextRequest) {
  const sessionOrError = await requireAuth()
  if (sessionOrError instanceof Response) return sessionOrError

  const { tx_hash } = await req.json()
  const receipt = await publicClient.getTransactionReceipt({
    hash: tx_hash as `0x${string}`,
  })

  // Parse JobCreated event from receipt
  // Store job record in Supabase
  // Return job details
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| System solc binary | solc npm package (solc-js) | Stable for years | No system dependency needed |
| OpenZeppelin v4.x | OpenZeppelin v5.x | 2024 | New import paths same for SafeERC20; `safeApprove` deprecated |
| baseSepolia for testing | base for mainnet deployment | This phase | Real USDC, real gas costs |
| Manual log[0].topics parsing | decodeEventLog iteration | viem best practice | Robust event parsing |

**Deprecated/outdated:**
- `safeApprove` in OpenZeppelin v5.x: Use `safeIncreaseAllowance`/`safeDecreaseAllowance` instead. However, the escrow contract only uses `safeTransfer` and `safeTransferFrom`, so this does not affect our contract.

## Key Facts (Verified)

| Fact | Value | Source | Confidence |
|------|-------|--------|------------|
| Base mainnet USDC address | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | BaseScan | HIGH |
| USDC decimals | 6 | BaseScan, existing code | HIGH |
| Treasury wallet | `0x0eEf9b6C1f35266A2440E0263C5B89AcaDd12d72` | Project context | HIGH |
| Deployer wallet | `0x6573F68F85b89727F8Ba9083fBc900Ec135653a1` | Project context | HIGH |
| OpenZeppelin latest | v5.4.0 | npm registry | HIGH |
| solc supports Solidity ^0.8.20 | Yes (latest solc-js is 0.8.28) | npm registry | HIGH |
| viem version in project | ^2.47.5 | package.json | HIGH |
| `@openzeppelin/contracts` installed | NO - must be added | node_modules check | HIGH |
| System `solc` binary | NOT installed on dev machine | `which solc` check | HIGH |
| Existing chain modules on baseSepolia | usdc.ts, escrow.ts, erc8004.ts, nft.ts | Code inspection | HIGH |
| subscriptions/route.ts already uses `base` mainnet | Yes, with correct USDC address | Code inspection | HIGH |

## Open Questions

1. **Escrow Jobs Supabase Table**
   - What we know: API routes need to store job metadata (jobId, client, agent, amount, status, tx_hash)
   - What's unclear: Whether a `jobs` table migration is needed or if on-chain state is sufficient
   - Recommendation: Create a `escrow_jobs` Supabase table to cache on-chain state for faster queries and to store off-chain metadata (description, timestamps)

2. **Client-Side Transaction Flow**
   - What we know: Current escrow.ts uses server-side private keys for all operations
   - What's unclear: Whether API routes should verify client-signed transactions (like subscriptions) or execute server-side
   - Recommendation: Follow the subscriptions pattern: client signs in wallet, sends tx_hash to API, API verifies on-chain. Server-side signing only for treasury operations.

3. **Contract Verification on BaseScan**
   - What we know: Contracts can be verified on BaseScan for transparency
   - What's unclear: Whether to verify the contract source on BaseScan
   - Recommendation: Verify after deployment using BaseScan's standard JSON verification (submit the solc input JSON). Not blocking for API functionality.

## Sources

### Primary (HIGH confidence)
- [BaseScan USDC Token](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) - Confirmed address and decimals
- [viem deployContract docs](https://viem.sh/docs/contract/deployContract.html) - Deployment API
- [solc npm package](https://www.npmjs.com/package/solc) - JavaScript Solidity compiler
- [@openzeppelin/contracts npm](https://www.npmjs.com/package/@openzeppelin/contracts) - v5.4.0 latest
- Project source code inspection - escrow.ts, deploy-escrow.ts, usdc.ts, erc8004.ts, subscriptions/route.ts

### Secondary (MEDIUM confidence)
- [OpenZeppelin Forum: solc remappings](https://forum.openzeppelin.com/t/solidity-compiler-solc-path-remappings-for-openzeppelin-contracts/2182) - Import resolution patterns
- [Solidity docs: import resolution](https://docs.soliditylang.org/en/v0.8.17/path-resolution.html) - Base path and include path docs
- [Approval Vulnerabilities - SCSFG](https://scsfg.io/hackers/approvals/) - Approval front-running analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified in existing project or npm registry
- Architecture: HIGH - Following established project patterns (subscriptions, erc8004)
- Pitfalls: HIGH - Based on verified code inspection and well-known Solidity patterns
- Compilation: HIGH - solc-js import callback approach verified in multiple sources

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable domain, no fast-moving dependencies)
