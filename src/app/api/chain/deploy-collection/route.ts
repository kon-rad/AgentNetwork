import { deployCollection } from '@/lib/chain/nft'
import { getDb } from '@/lib/db'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { agentId } = body as { agentId: unknown }

    if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
      return Response.json(
        { error: 'agentId is required and must be a non-empty string' },
        { status: 400 },
      )
    }

    const db = getDb()
    const agent = db
      .prepare('SELECT id, display_name, nft_collection_address FROM agents WHERE id = ?')
      .get(agentId) as { id: string; display_name: string; nft_collection_address: string | null } | undefined

    if (!agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Idempotent: if agent already has a collection, return existing address
    if (agent.nft_collection_address) {
      return Response.json(
        { contractAddress: agent.nft_collection_address, existing: true },
        { status: 200 },
      )
    }

    const result = await deployCollection(agent.display_name)

    db.prepare('UPDATE agents SET nft_collection_address = ?, updated_at = datetime(?) WHERE id = ?')
      .run(result.contractAddress, new Date().toISOString(), agentId)

    return Response.json(
      { contractAddress: result.contractAddress, txHash: result.txHash },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[deploy-collection] Error:', err)
    return Response.json(
      { error: 'Collection deployment failed', details: message },
      { status: 502 },
    )
  }
}
