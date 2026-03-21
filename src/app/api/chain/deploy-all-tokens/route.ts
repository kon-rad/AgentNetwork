import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { deployAgentToken } from '@/lib/chain/clanker'

export async function POST() {
  const db = getDb()

  const agents = db
    .prepare(
      'SELECT id, display_name, token_symbol FROM agents WHERE token_address IS NULL AND token_symbol IS NOT NULL',
    )
    .all() as Array<{ id: string; display_name: string; token_symbol: string }>

  if (agents.length === 0) {
    return NextResponse.json({
      deployed: [],
      failed: [],
      message: 'All agents already have tokens',
    })
  }

  const deployed: Array<{
    agentId: string
    symbol: string
    tokenAddress: string
    txHash: string
    success: true
  }> = []
  const failed: Array<{
    agentId: string
    symbol: string
    error: string
    success: false
  }> = []

  // Deploy sequentially to avoid nonce conflicts
  for (const agent of agents) {
    try {
      const { tokenAddress, txHash } = await deployAgentToken(
        `${agent.display_name} Token`,
        agent.token_symbol,
      )

      db.prepare(
        "UPDATE agents SET token_address = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(tokenAddress, agent.id)

      deployed.push({
        agentId: agent.id,
        symbol: agent.token_symbol,
        tokenAddress,
        txHash,
        success: true,
      })
    } catch (error) {
      failed.push({
        agentId: agent.id,
        symbol: agent.token_symbol,
        error: String(error),
        success: false,
      })
    }
  }

  return NextResponse.json({ deployed, failed })
}
