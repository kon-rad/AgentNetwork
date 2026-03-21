import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
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

  const { data: agent, error: fetchError } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, token_symbol, token_address')
    .eq('id', agentId)
    .maybeSingle()

  if (fetchError || !agent) {
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

    await supabaseAdmin
      .from('agents')
      .update({ token_address: tokenAddress, updated_at: new Date().toISOString() })
      .eq('id', agent.id)

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
