import 'server-only'
import { createWalletClient, createPublicClient, http, parseUnits, decodeEventLog, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { USDC_ADDRESS, USDC_DECIMALS } from './usdc'
import agentEscrowAbi from './abi/AgentEscrow.json'

export const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS as `0x${string}`

/**
 * ABI for the AgentEscrow contract.
 * Imported from the generated JSON file (produced by scripts/deploy-escrow.ts --compile-only).
 */
export const escrowAbi = agentEscrowAbi as readonly Record<string, unknown>[]

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

// JobCreated event ABI for decodeEventLog parsing
const jobCreatedEventAbi = [
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

export enum JobStatus {
  Active = 0,
  Released = 1,
  Disputed = 2,
  Resolved = 3,
  Refunded = 4,
}

function getPublicClient() {
  return createPublicClient({ chain: base, transport: http() })
}

function getWalletClient(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey)
  return createWalletClient({ account, chain: base, transport: http() })
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

  // Parse JobCreated event using decodeEventLog (same pattern as erc8004.ts)
  let jobId: bigint | undefined
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: jobCreatedEventAbi,
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

  if (jobId === undefined) {
    throw new Error('Failed to parse jobId from JobCreated event in transaction receipt')
  }

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
  const result = await publicClient.readContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'jobs',
    args: [jobId],
  }) as readonly [`0x${string}`, `0x${string}`, bigint, number]
  const [client, agent, amount, status] = result
  return {
    client,
    agent,
    amount,
    status: status as JobStatus,
  }
}
