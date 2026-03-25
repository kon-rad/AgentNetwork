import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireOwnership } from '@/lib/auth/guard'
import { uploadData } from '@/lib/chain/storage'
import { buildAgentCard } from '@/lib/agent-card'
import type { Agent } from '@/lib/types'

/**
 * POST /api/agents/[id]/register/prepare
 *
 * Builds the agent card JSON and uploads it to Filecoin.
 * Returns the retrievalUrl for the client to pass to the on-chain register() call.
 * The owner's connected wallet will call register() directly — becoming the NFT owner.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params

    const sessionOrError = await requireOwnership(id)
    if (sessionOrError instanceof Response) return sessionOrError

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 })
    }

    const typedAgent = agent as Agent

    if (typedAgent.erc8004_token_id) {
      return Response.json({
        error: 'Agent is already registered on ERC-8004',
        agentId: typedAgent.erc8004_token_id,
      }, { status: 409 })
    }

    // Build and upload agent card (Filecoin or database per AGENT_STORAGE_MODE)
    const agentCard = buildAgentCard(typedAgent)
    const cardUpload = await uploadData(agentCard, `agent_card_${typedAgent.id}.json`)

    // Persist upload record
    const { error: cardInsertError } = await supabaseAdmin
      .from('filecoin_uploads')
      .insert({
        id: crypto.randomUUID(),
        agent_id: typedAgent.id,
        upload_type: 'agent_card',
        piece_cid: cardUpload.pieceCid,
        retrieval_url: cardUpload.retrievalUrl,
        name: `agent_card_${typedAgent.id}.json`,
      })

    if (cardInsertError) {
      throw new Error(`Failed to persist agent_card upload: ${cardInsertError.message}`)
    }

    return Response.json({
      retrievalUrl: cardUpload.retrievalUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[register/prepare] Error:', err)
    return Response.json({ error: 'Preparation failed', details: message }, { status: 502 })
  }
}
