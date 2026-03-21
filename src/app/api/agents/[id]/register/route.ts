import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { registerAgent } from '@/lib/chain/erc8004'
import { uploadToFilecoin } from '@/lib/chain/filecoin'
import { buildAgentCard } from '@/lib/agent-card'
import { buildAgentLog, addLogEntry } from '@/lib/agent-log'
import type { Agent } from '@/lib/types'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params
    const db = getDb()

    // Load agent from DB
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent | undefined
    if (!agent) {
      return Response.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Idempotency: if already registered, return existing info
    if (agent.erc8004_token_id) {
      return Response.json({
        agentId: agent.erc8004_token_id,
        message: 'Agent is already registered on ERC-8004',
        basescanUrl: `https://sepolia.basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=${agent.erc8004_token_id}`,
      })
    }

    // Generate agent.json card
    const agentCard = buildAgentCard(agent)

    // Upload agent.json to Filecoin
    const cardUpload = await uploadToFilecoin(agentCard, `agent_card_${agent.id}.json`)

    // Persist agent_card upload to filecoin_uploads table
    const cardUploadId = crypto.randomUUID()
    db.prepare(
      `INSERT INTO filecoin_uploads (id, agent_id, upload_type, piece_cid, retrieval_url, name)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(cardUploadId, agent.id, 'agent_card', cardUpload.pieceCid, cardUpload.retrievalUrl, `agent_card_${agent.id}.json`)

    const retrievalUrl = cardUpload.retrievalUrl

    // Register on-chain via ERC-8004 IdentityRegistry
    const { agentId, txHash } = await registerAgent(retrievalUrl)

    // Store token ID in DB
    db.prepare(
      `UPDATE agents SET erc8004_token_id = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(agentId.toString(), agent.id)

    // Generate and upload agent_log.json
    let log = buildAgentLog(agent)
    log = addLogEntry(log, {
      action: 'register_identity',
      status: 'success',
      details: {
        txHash,
        agentId: agentId.toString(),
        agentURI: retrievalUrl,
      },
    })

    const logUpload = await uploadToFilecoin(log, `agent_log_${agent.id}.json`)

    // Persist agent_log upload to filecoin_uploads table
    const logUploadId = crypto.randomUUID()
    db.prepare(
      `INSERT INTO filecoin_uploads (id, agent_id, upload_type, piece_cid, retrieval_url, name)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(logUploadId, agent.id, 'agent_log', logUpload.pieceCid, logUpload.retrievalUrl, `agent_log_${agent.id}.json`)

    return Response.json(
      {
        agentId: agentId.toString(),
        txHash,
        basescanUrl: `https://sepolia.basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=${agentId}`,
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
