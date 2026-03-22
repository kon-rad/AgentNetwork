import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/guard'
import { resolveDispute } from '@/lib/chain/escrow'

/**
 * POST /api/escrow/[jobId]/resolve - Treasury resolves dispute (server-side signing)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const sessionOrError = await requireAuth()
  if (sessionOrError instanceof Response) return sessionOrError
  const session = sessionOrError

  // Only treasury wallet can resolve disputes
  const treasuryAddress = process.env.TREASURY_ADDRESS
  if (!treasuryAddress) {
    console.error('TREASURY_ADDRESS env var not set')
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (session.address!.toLowerCase() !== treasuryAddress.toLowerCase()) {
    return Response.json({ error: 'Forbidden - only treasury can resolve disputes' }, { status: 403 })
  }

  const { jobId } = await params

  let body: { toAgentUsdc?: string; toClientUsdc?: string; toTreasuryUsdc?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { toAgentUsdc, toClientUsdc, toTreasuryUsdc } = body
  if (!toAgentUsdc || !toClientUsdc || !toTreasuryUsdc) {
    return Response.json(
      { error: 'toAgentUsdc, toClientUsdc, and toTreasuryUsdc are all required' },
      { status: 400 }
    )
  }

  try {
    const txHash = await resolveDispute(
      BigInt(jobId),
      toAgentUsdc,
      toClientUsdc,
      toTreasuryUsdc,
    )

    return Response.json({
      jobId,
      status: 'Resolved',
      txHash,
    })
  } catch (err) {
    console.error('Failed to resolve dispute:', err)
    return Response.json({ error: 'Failed to resolve dispute on-chain' }, { status: 500 })
  }
}
