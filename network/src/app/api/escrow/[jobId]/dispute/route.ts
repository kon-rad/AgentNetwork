import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { getJob, escrowAbi, JobStatus } from '@/lib/chain/escrow'
import { createPublicClient, http, decodeEventLog } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({ chain: base, transport: http() })

/**
 * POST /api/escrow/[jobId]/dispute - Verify dispute raised on-chain
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const sessionOrError = await requireAuth()
  if (sessionOrError instanceof Response) return sessionOrError
  const session = sessionOrError

  const { jobId } = await params

  let body: { tx_hash?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tx_hash } = body
  if (!tx_hash || typeof tx_hash !== 'string') {
    return Response.json({ error: 'tx_hash is required' }, { status: 400 })
  }

  // Fetch transaction receipt
  let receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>>
  try {
    receipt = await publicClient.getTransactionReceipt({
      hash: tx_hash as `0x${string}`,
    })
  } catch {
    return Response.json({ error: 'Transaction not found or not confirmed' }, { status: 422 })
  }

  if (!receipt || receipt.status !== 'success') {
    return Response.json({ error: 'Transaction failed or reverted' }, { status: 422 })
  }

  // Verify sender matches authenticated wallet
  if (receipt.from.toLowerCase() !== session.address!.toLowerCase()) {
    return Response.json({ error: 'Transaction sender does not match authenticated wallet' }, { status: 422 })
  }

  // Parse JobDisputed event from receipt logs
  let disputedJobId: bigint | undefined
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === 'JobDisputed') {
        const args = decoded.args as { jobId: bigint; disputedBy: string }
        disputedJobId = args.jobId
        break
      }
    } catch {
      // Not a matching event -- skip
    }
  }

  if (disputedJobId === undefined) {
    return Response.json({ error: 'JobDisputed event not found in transaction' }, { status: 422 })
  }

  if (disputedJobId.toString() !== jobId) {
    return Response.json({ error: 'JobDisputed event jobId does not match route param' }, { status: 422 })
  }

  // Confirm on-chain status is now Disputed
  try {
    const job = await getJob(BigInt(jobId))
    if (job.status !== JobStatus.Disputed) {
      return Response.json({ error: 'Job status is not Disputed on-chain' }, { status: 422 })
    }
  } catch (err) {
    console.error('Failed to verify job status:', err)
    return Response.json({ error: 'Failed to verify job status on-chain' }, { status: 500 })
  }

  return Response.json({
    jobId,
    status: 'Disputed',
    txHash: tx_hash,
  })
}
