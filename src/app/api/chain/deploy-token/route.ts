import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { deployAgentToken } from '@/lib/chain/clanker'

export async function POST(request: NextRequest) {
  let body: { agentId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { agentId } = body
  if (!agentId) {
    return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
  }

  const db = getDb()

  const agent = db
    .prepare(
      'SELECT id, display_name, token_symbol, token_address FROM agents WHERE id = ?',
    )
    .get(agentId) as
    | { id: string; display_name: string; token_symbol: string | null; token_address: string | null }
    | undefined

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  if (!agent.token_symbol) {
    return NextResponse.json(
      { error: 'Agent has no token_symbol configured' },
      { status: 400 },
    )
  }

  if (agent.token_address) {
    return NextResponse.json(
      {
        error: 'Agent already has a deployed token',
        agentId: agent.id,
        symbol: agent.token_symbol,
        tokenAddress: agent.token_address,
      },
      { status: 409 },
    )
  }

  try {
    const { tokenAddress, txHash } = await deployAgentToken(
      `${agent.display_name} Token`,
      agent.token_symbol,
    )

    db.prepare(
      "UPDATE agents SET token_address = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(tokenAddress, agent.id)

    return NextResponse.json({
      agentId: agent.id,
      symbol: agent.token_symbol,
      tokenAddress,
      txHash,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Clanker SDK failure', details: String(error) },
      { status: 502 },
    )
  }
}
