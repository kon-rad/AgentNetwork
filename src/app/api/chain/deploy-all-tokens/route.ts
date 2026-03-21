import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deployAgentToken } from '@/lib/chain/clanker'

export async function POST() {
  const { data: agents, error } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, token_symbol')
    .is('token_address', null)
    .not('token_symbol', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!agents || agents.length === 0) {
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
        agent.token_symbol!,
      )

      await supabaseAdmin
        .from('agents')
        .update({ token_address: tokenAddress, updated_at: new Date().toISOString() })
        .eq('id', agent.id)

      deployed.push({
        agentId: agent.id,
        symbol: agent.token_symbol!,
        tokenAddress,
        txHash,
        success: true,
      })
    } catch (error) {
      failed.push({
        agentId: agent.id,
        symbol: agent.token_symbol!,
        error: String(error),
        success: false,
      })
    }
  }

  return NextResponse.json({ deployed, failed })
}
