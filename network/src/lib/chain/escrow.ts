import 'server-only'
import { createWalletClient, createPublicClient, http, parseUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { USDC_ADDRESS, USDC_DECIMALS } from './usdc'

const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS as `0x${string}`

// Minimal ABI — only functions we call from the server
const escrowAbi = [
  {
    name: 'createJob',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'jobId', type: 'uint256' }],
  },
  {
    name: 'releaseJob',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'disputeJob',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'resolveDispute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'toAgent', type: 'uint256' },
      { name: 'toClient', type: 'uint256' },
      { name: 'toTreasuryAmt', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'refundJob',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'jobs',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [
      { name: 'client', type: 'address' },
      { name: 'agent', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
  },
  {
    name: 'nextJobId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// USDC approve ABI (client needs to approve escrow before createJob)
const approveAbi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export enum JobStatus {
  Active = 0,
  Released = 1,
  Disputed = 2,
  Resolved = 3,
  Refunded = 4,
}

function getPublicClient() {
  return createPublicClient({ chain: baseSepolia, transport: http() })
}

function getWalletClient(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({ account, chain: baseSepolia, transport: http() })
}

/**
 * Step 1: Client approves USDC spending by escrow contract.
 */
export async function approveEscrowSpend(
  amount: string,
  clientPrivateKey: Hex,
): Promise<string> {
  const wallet = getWalletClient(clientPrivateKey)
  const txHash = await wallet.writeContract({
    address: USDC_ADDRESS,
    abi: approveAbi,
    functionName: 'approve',
    args: [ESCROW_ADDRESS, parseUnits(amount, USDC_DECIMALS)],
  })
  return txHash
}

/**
 * Step 2: Client creates a job, locking USDC in escrow.
 */
export async function createJob(
  agentAddress: `0x${string}`,
  amount: string,
  clientPrivateKey: Hex,
): Promise<{ jobId: bigint; txHash: string }> {
  const wallet = getWalletClient(clientPrivateKey)
  const publicClient = getPublicClient()

  const txHash = await wallet.writeContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'createJob',
    args: [agentAddress, parseUnits(amount, USDC_DECIMALS)],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  // Parse JobCreated event to get jobId
  const jobCreatedTopic = '0x' // Will match first indexed param
  const jobId = receipt.logs[0]?.topics[1]
    ? BigInt(receipt.logs[0].topics[1])
    : BigInt(0)

  return { jobId, txHash }
}

/**
 * Client releases funds to agent after job completion.
 */
export async function releaseJob(
  jobId: bigint,
  clientPrivateKey: Hex,
): Promise<string> {
  const wallet = getWalletClient(clientPrivateKey)
  return wallet.writeContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'releaseJob',
    args: [jobId],
  })
}

/**
 * Either party raises a dispute.
 */
export async function disputeJob(
  jobId: bigint,
  callerPrivateKey: Hex,
): Promise<string> {
  const wallet = getWalletClient(callerPrivateKey)
  return wallet.writeContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'disputeJob',
    args: [jobId],
  })
}

/**
 * Treasury resolves a dispute by splitting the escrowed amount.
 */
export async function resolveDispute(
  jobId: bigint,
  toAgentUsdc: string,
  toClientUsdc: string,
  toTreasuryUsdc: string,
): Promise<string> {
  const treasuryKey = process.env.TREASURY_PRIVATE_KEY as Hex
  if (!treasuryKey) throw new Error('TREASURY_PRIVATE_KEY not set')

  const wallet = getWalletClient(treasuryKey)
  return wallet.writeContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'resolveDispute',
    args: [
      jobId,
      parseUnits(toAgentUsdc, USDC_DECIMALS),
      parseUnits(toClientUsdc, USDC_DECIMALS),
      parseUnits(toTreasuryUsdc, USDC_DECIMALS),
    ],
  })
}

/**
 * Treasury refunds the full amount to the client.
 */
export async function refundJob(jobId: bigint): Promise<string> {
  const treasuryKey = process.env.TREASURY_PRIVATE_KEY as Hex
  if (!treasuryKey) throw new Error('TREASURY_PRIVATE_KEY not set')

  const wallet = getWalletClient(treasuryKey)
  return wallet.writeContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'refundJob',
    args: [jobId],
  })
}

/**
 * Read a job's current state.
 */
export async function getJob(jobId: bigint) {
  const publicClient = getPublicClient()
  const [client, agent, amount, status] = await publicClient.readContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'jobs',
    args: [jobId],
  })
  return {
    client,
    agent,
    amount,
    status: status as JobStatus,
  }
}
