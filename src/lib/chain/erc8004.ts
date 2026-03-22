import 'server-only'
import { createWalletClient, createPublicClient, http, decodeEventLog, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

// ERC-8004 contract addresses on Base Sepolia
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

// Registered event ABI — needed for parsing receipts
const registeredEventAbi = [
  {
    name: 'Registered',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
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
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY env var is required')
  }
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({ account, chain: baseSepolia, transport: http() })
}

function getPublicClient() {
  return createPublicClient({ chain: baseSepolia, transport: http() })
}

/**
 * Register an agent on-chain via the ERC-8004 IdentityRegistry.
 * Calls register(agentURI), waits for receipt, parses Registered event for agentId.
 */
export async function registerAgent(
  agentURI: string,
): Promise<{ agentId: bigint; txHash: string }> {
  const wallet = getWalletClient()
  const txHash = await wallet.writeContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'register',
    args: [agentURI],
  })

  const publicClient = getPublicClient()
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  // Iterate logs and match by Registered event signature (do NOT use log index position)
  let agentId: bigint | undefined
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: registeredEventAbi,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === 'Registered') {
        agentId = decoded.args.agentId
        break
      }
    } catch {
      // Not a Registered event — skip
    }
  }

  if (agentId === undefined) {
    throw new Error('Failed to parse agentId from Registered event in transaction receipt')
  }

  return { agentId, txHash }
}

/**
 * Submit reputation feedback for an agent via the ERC-8004 ReputationRegistry.
 * Returns the transaction hash.
 */
export async function submitFeedback(
  agentId: bigint,
  value: number,
  tag1: string,
  tag2: string,
): Promise<string> {
  const wallet = getWalletClient()
  const txHash = await wallet.writeContract({
    address: REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'giveFeedback',
    args: [
      agentId,
      BigInt(value),
      0,
      tag1,
      tag2,
      '',
      '',
      ('0x' + '0'.repeat(64)) as `0x${string}`,
    ],
  })
  return txHash
}

/**
 * Read the reputation summary for an agent from the ERC-8004 ReputationRegistry.
 */
export async function getReputationSummary(
  agentId: bigint,
): Promise<{ count: bigint; value: bigint; decimals: number }> {
  const publicClient = getPublicClient()
  const result = await publicClient.readContract({
    address: REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'getSummary',
    args: [agentId, [], '', ''],
  })

  const [count, value, decimals] = result as [bigint, bigint, number]
  return { count, value, decimals }
}
