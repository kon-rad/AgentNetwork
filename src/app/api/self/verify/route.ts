import { verifySelfProof } from '@/lib/chain/self'
import { getDb } from '@/lib/db'

export async function POST(req: Request): Promise<Response> {
  try {
    const { attestationId, proof, publicSignals, userContextData } = await req.json()

    if (!attestationId || !proof || !publicSignals || !userContextData) {
      return Response.json({
        status: 'error',
        result: false,
        reason: 'Missing required fields',
      })
    }

    const result = await verifySelfProof(attestationId, proof, publicSignals, userContextData)

    if (!result.isValidDetails.isValid) {
      return Response.json({
        status: 'error',
        result: false,
        reason: 'Verification failed',
      })
    }

    // Extract wallet address from userIdentifier and mark agent verified in SQLite
    const userWallet = result.userData?.userIdentifier
    if (userWallet) {
      const db = getDb()
      db.prepare('UPDATE agents SET self_verified = 1 WHERE wallet_address = ?').run(userWallet)
    }

    return Response.json({ status: 'success', result: true })
  } catch (error) {
    return Response.json({
      status: 'error',
      result: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
