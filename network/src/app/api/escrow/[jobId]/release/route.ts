import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { getJob, escrowAbi, JobStatus } from '@/lib/chain/escrow'
import { createPublicClient, http, decodeEventLog } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({ chain: base, transport: http() })

/**
 * POST /api/escrow/[jobId]/release - Verify client released funds on-chain
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

  // Parse JobReleased event from receipt logs
  let releasedJobId: bigint | undefined
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === 'JobReleased') {
        const args = decoded.args as { jobId: bigint }
        releasedJobId = args.jobId
        break
      }
    } catch {
      // Not a matching event -- skip
    }
  }

  if (releasedJobId === undefined) {
    return Response.json({ error: 'JobReleased event not found in transaction' }, { status: 422 })
  }

  if (releasedJobId.toString() !== jobId) {
    return Response.json({ error: 'JobReleased event jobId does not match route param' }, { status: 422 })
  }

  // Confirm on-chain status is now Released
  try {
    const job = await getJob(BigInt(jobId))
    if (job.status !== JobStatus.Released) {
      return Response.json({ error: 'Job status is not Released on-chain' }, { status: 422 })
    }
  } catch (err) {
    console.error('Failed to verify job status:', err)
    return Response.json({ error: 'Failed to verify job status on-chain' }, { status: 500 })
  }

  return Response.json({
    jobId,
    status: 'Released',
    txHash: tx_hash,
  })
}
