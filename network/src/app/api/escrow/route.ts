import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { getJob, ESCROW_ADDRESS, escrowAbi, JobStatus } from '@/lib/chain/escrow'
import { createPublicClient, http, decodeEventLog, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { USDC_DECIMALS } from '@/lib/chain/usdc'

const publicClient = createPublicClient({ chain: base, transport: http() })

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.Active]: 'Active',
  [JobStatus.Released]: 'Released',
  [JobStatus.Disputed]: 'Disputed',
  [JobStatus.Resolved]: 'Resolved',
  [JobStatus.Refunded]: 'Refunded',
}

/**
 * POST /api/escrow - Verify on-chain job creation from client-signed tx_hash
 */
export async function POST(req: NextRequest) {
  const sessionOrError = await requireAuth()
  if (sessionOrError instanceof Response) return sessionOrError
  const session = sessionOrError

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

  // Parse JobCreated event from receipt logs
  let jobId: bigint | undefined
  let client: string | undefined
  let agent: string | undefined
  let amount: bigint | undefined

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: escrowAbi,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === 'JobCreated') {
        const args = decoded.args as { jobId: bigint; client: string; agent: string; amount: bigint }
        jobId = args.jobId
        client = args.client
        agent = args.agent
        amount = args.amount
        break
      }
    } catch {
      // Not a matching event -- skip
    }
  }

  if (jobId === undefined || !client || !agent || amount === undefined) {
    return Response.json({ error: 'JobCreated event not found in transaction' }, { status: 422 })
  }

  return Response.json({
    jobId: jobId.toString(),
    client,
    agent,
    amount: formatUnits(amount, USDC_DECIMALS),
    status: 'Active',
    txHash: tx_hash,
    basescanUrl: `https://basescan.org/tx/${tx_hash}`,
  })
}

/**
 * GET /api/escrow?jobId=N - Read job status from on-chain contract
 */
export async function GET(req: NextRequest) {
  const sessionOrError = await requireAuth()
  if (sessionOrError instanceof Response) return sessionOrError

  const jobIdParam = req.nextUrl.searchParams.get('jobId')
  if (!jobIdParam) {
    return Response.json({ error: 'jobId query parameter is required' }, { status: 400 })
  }

  let jobIdBigInt: bigint
  try {
    jobIdBigInt = BigInt(jobIdParam)
  } catch {
    return Response.json({ error: 'jobId must be a valid integer' }, { status: 400 })
  }

  try {
    const job = await getJob(jobIdBigInt)
    return Response.json({
      jobId: jobIdParam,
      client: job.client,
      agent: job.agent,
      amount: formatUnits(job.amount, USDC_DECIMALS),
      status: JOB_STATUS_LABELS[job.status] ?? 'Unknown',
      statusCode: job.status,
    })
  } catch (err) {
    console.error('Failed to read job from chain:', err)
    return Response.json({ error: 'Failed to read job from chain' }, { status: 500 })
  }
}
