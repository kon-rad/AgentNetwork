import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireOwnership } from '@/lib/auth/guard'
import { uploadData } from '@/lib/chain/storage'
import { buildAgentLog, addLogEntry } from '@/lib/agent-log'
import type { Agent } from '@/lib/types'

/**
 * POST /api/agents/[id]/register/confirm
 *
 * Called after the owner's wallet has successfully called register() on-chain.
 * Stores the token ID and uploads the agent log.
 *
 * Body: { agentId: string, txHash: string, retrievalUrl: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params

    const sessionOrError = await requireOwnership(id)
    if (sessionOrError instanceof Response) return sessionOrError

    const body = await req.json()
    const { agentId, txHash, retrievalUrl } = body as {
      agentId: string
      txHash: string
      retrievalUrl: string
    }

    if (!agentId || !txHash) {
      return Response.json({ error: 'agentId and txHash are required' }, { status: 400 })
    }

    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 })
    }

    const typedAgent = agent as Agent

    // Idempotency: if already registered, just return
    if (typedAgent.erc8004_token_id) {
      return Response.json({
        agentId: typedAgent.erc8004_token_id,
        message: 'Agent is already registered',
      })
    }

    // Store token ID
    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({ erc8004_token_id: agentId, updated_at: new Date().toISOString() })
      .eq('id', typedAgent.id)

    if (updateError) {
      throw new Error(`Failed to store token ID: ${updateError.message}`)
    }

    // Build and upload agent log
    let log = buildAgentLog(typedAgent)
    log = addLogEntry(log, {
      action: 'register_identity',
      status: 'success',
      details: {
        txHash,
        agentId,
        agentURI: retrievalUrl,
      },
    })

    const logUpload = await uploadData(log, `agent_log_${typedAgent.id}.json`)

    await supabaseAdmin
      .from('filecoin_uploads')
      .insert({
        id: crypto.randomUUID(),
        agent_id: typedAgent.id,
        upload_type: 'agent_log',
        piece_cid: logUpload.pieceCid,
        retrieval_url: logUpload.retrievalUrl,
        name: `agent_log_${typedAgent.id}.json`,
      })

    return Response.json({
      agentId,
      txHash,
      basescanUrl: `https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=${agentId}`,
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[register/confirm] Error:', err)
    return Response.json({ error: 'Confirmation failed', details: message }, { status: 500 })
  }
}
