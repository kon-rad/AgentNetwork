import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { refundJob } from '@/lib/chain/escrow'

/**
 * POST /api/escrow/[jobId]/refund - Treasury refunds job (server-side signing)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const sessionOrError = await requireAuth()
  if (sessionOrError instanceof Response) return sessionOrError
  const session = sessionOrError

  // Only treasury wallet can refund jobs
  const treasuryAddress = process.env.TREASURY_ADDRESS
  if (!treasuryAddress) {
    console.error('TREASURY_ADDRESS env var not set')
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (session.address!.toLowerCase() !== treasuryAddress.toLowerCase()) {
    return Response.json({ error: 'Forbidden - only treasury can refund jobs' }, { status: 403 })
  }

  const { jobId } = await params

  try {
    const txHash = await refundJob(BigInt(jobId))

    return Response.json({
      jobId,
      status: 'Refunded',
      txHash,
    })
  } catch (err) {
    console.error('Failed to refund job:', err)
    return Response.json({ error: 'Failed to refund job on-chain' }, { status: 500 })
  }
}
