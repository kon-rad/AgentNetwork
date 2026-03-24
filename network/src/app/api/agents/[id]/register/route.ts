import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireOwnership } from '@/lib/auth/guard'
import { registerAgent } from '@/lib/chain/erc8004'
import { uploadData } from '@/lib/chain/storage'
import { buildAgentCard } from '@/lib/agent-card'
import { buildAgentLog, addLogEntry } from '@/lib/agent-log'
import { getAgentPrivateKey } from '@/lib/chain/wallet-keys'
import type { Agent } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params

    // Verify the signed-in user owns this agent
    const sessionOrError = await requireOwnership(id)
    if (sessionOrError instanceof Response) return sessionOrError

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

    // Idempotency: if already registered, return existing info
    if (typedAgent.erc8004_token_id) {
      return Response.json({
        agentId: typedAgent.erc8004_token_id,
        message: 'Agent is already registered on ERC-8004',
        basescanUrl: `https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=${typedAgent.erc8004_token_id}`,
      })
    }

    // Fetch the agent's private key from agent_wallet_keys (encrypted at rest)
    const privateKey = await getAgentPrivateKey(id)
    if (!privateKey) {
      return Response.json(
        { error: 'No wallet key found for this agent. The agent wallet must be generated first.' },
        { status: 400 },
      )
    }

    // Generate agent.json card
    const agentCard = buildAgentCard(typedAgent)

    // Upload agent.json to Filecoin
    const cardUpload = await uploadData(agentCard, `agent_card_${typedAgent.id}.json`)

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
    const { agentId, txHash } = await registerAgent(retrievalUrl, privateKey)

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

    const logUpload = await uploadData(log, `agent_log_${typedAgent.id}.json`)

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
        basescanUrl: `https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=${agentId}`,
        filecoinUrl: retrievalUrl,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Extract nested cause details if available
    const cause = (err as { cause?: { details?: string } })?.cause
    const fullDetails = cause?.details ? `${message} — ${cause.details}` : message

    // Insufficient funds — parse and surface helpful info
    const fundsMatch = fullDetails.match(
      /InsufficientLockupFunds\(.*?\)\s*\(([^,]+),\s*(\d+),\s*(\d+)\)/,
    )
    if (fundsMatch) {
      const [, wallet, requiredWei, availableWei] = fundsMatch
      const required = (Number(requiredWei) / 1e18).toFixed(2)
      const available = (Number(availableWei) / 1e18).toFixed(2)
      return Response.json(
        {
          error: 'Insufficient Filecoin storage funds',
          details: `Wallet ${wallet} needs at least ${required} FIL for storage lockup (current balance: ${available} FIL). Send FIL to this address on Filecoin mainnet.`,
          wallet,
          required: `${required} FIL`,
          available: `${available} FIL`,
        },
        { status: 502 },
      )
    }

    // Filecoin or on-chain failures → 502
    if (
      message.includes('upload') ||
      message.includes('Filecoin') ||
      message.includes('PieceCID') ||
      message.includes('register') ||
      message.includes('transaction') ||
      message.includes('receipt') ||
      message.includes('commit') ||
      message.includes('StorageContext') ||
      message.includes('DataSet')
    ) {
      return Response.json(
        { error: 'Registration failed', details: fullDetails },
        { status: 502 },
      )
    }

    console.error('[register] Unexpected error:', err)
    return Response.json({ error: 'Internal server error', details: fullDetails }, { status: 500 })
  }
}
