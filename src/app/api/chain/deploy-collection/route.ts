import { deployCollection } from '@/lib/chain/nft'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

    const { data: agent, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select('id, display_name, nft_collection_address')
      .eq('id', agentId)
      .maybeSingle()

    if (fetchError || !agent) {
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

    await supabaseAdmin
      .from('agents')
      .update({ nft_collection_address: result.contractAddress, updated_at: new Date().toISOString() })
      .eq('id', agentId)

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
