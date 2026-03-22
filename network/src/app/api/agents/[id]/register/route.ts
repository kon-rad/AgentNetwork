import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { registerAgent } from '@/lib/chain/erc8004'
import { uploadToFilecoin } from '@/lib/chain/filecoin'
import { buildAgentCard } from '@/lib/agent-card'
import { buildAgentLog, addLogEntry } from '@/lib/agent-log'
import { privateKeyToAccount } from 'viem/accounts'
import type { Agent } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params

    // Agent must provide their own private key to register themselves
    const body = await req.json().catch(() => ({}))
    const { private_key } = body as { private_key?: string }

    if (!private_key || !private_key.startsWith('0x')) {
      return Response.json(
        { error: 'private_key is required in request body (hex string starting with 0x). The agent registers themselves — no platform wallet involved.' },
        { status: 400 },
      )
    }

    const typedPrivateKey = private_key as `0x${string}`

    // Load agent from DB
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 })
    }

    const typedAgent = agent as Agent

    // Validate the private key derives to the agent's wallet address
    const account = privateKeyToAccount(typedPrivateKey)
    if (account.address.toLowerCase() !== typedAgent.wallet_address.toLowerCase()) {
      return Response.json(
        { error: 'Forbidden: private key does not match agent wallet_address' },
        { status: 403 },
      )
    }

    // Idempotency: if already registered, return existing info
    if (typedAgent.erc8004_token_id) {
      return Response.json({
        agentId: typedAgent.erc8004_token_id,
        message: 'Agent is already registered on ERC-8004',
        basescanUrl: `https://basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=${typedAgent.erc8004_token_id}`,
      })
    }

    // Generate agent.json card
    const agentCard = buildAgentCard(typedAgent)

    // Upload agent.json to Filecoin
    const cardUpload = await uploadToFilecoin(agentCard, `agent_card_${typedAgent.id}.json`)

    // Persist agent_card upload to filecoin_uploads table
    const cardUploadId = crypto.randomUUID()
    const { error: cardInsertError } = await supabaseAdmin
      .from('filecoin_uploads')
      .insert({
        id: cardUploadId,
        agent_id: typedAgent.id,
        upload_type: 'agent_card',
        piece_cid: cardUpload.pieceCid,
        retrieval_url: cardUpload.retrievalUrl,
        name: `agent_card_${typedAgent.id}.json`,
      })

    if (cardInsertError) {
      throw new Error(`Failed to persist agent_card upload: ${cardInsertError.message}`)
    }

    const retrievalUrl = cardUpload.retrievalUrl

    // Register on-chain — the agent's own wallet calls register(), becoming the NFT owner
    const { agentId, txHash } = await registerAgent(retrievalUrl, typedPrivateKey)

    // Store token ID in DB
    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({ erc8004_token_id: agentId.toString(), updated_at: new Date().toISOString() })
      .eq('id', typedAgent.id)

    if (updateError) {
      throw new Error(`Failed to store token ID: ${updateError.message}`)
    }

    // Generate and upload agent_log.json
    let log = buildAgentLog(typedAgent)
    log = addLogEntry(log, {
      action: 'register_identity',
      status: 'success',
      details: {
        txHash,
        agentId: agentId.toString(),
        agentURI: retrievalUrl,
      },
    })

    const logUpload = await uploadToFilecoin(log, `agent_log_${typedAgent.id}.json`)

    // Persist agent_log upload to filecoin_uploads table
    const logUploadId = crypto.randomUUID()
    await supabaseAdmin
      .from('filecoin_uploads')
      .insert({
        id: logUploadId,
        agent_id: typedAgent.id,
        upload_type: 'agent_log',
        piece_cid: logUpload.pieceCid,
        retrieval_url: logUpload.retrievalUrl,
        name: `agent_log_${typedAgent.id}.json`,
      })

    return Response.json(
      {
        agentId: agentId.toString(),
        txHash,
        basescanUrl: `https://basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=${agentId}`,
        filecoinUrl: retrievalUrl,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Filecoin or on-chain failures → 502
    if (
      message.includes('upload') ||
      message.includes('Filecoin') ||
      message.includes('PieceCID') ||
      message.includes('register') ||
      message.includes('transaction') ||
      message.includes('receipt')
    ) {
      return Response.json(
        { error: 'Registration failed', details: message },
        { status: 502 },
      )
    }

    console.error('[register] Unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
