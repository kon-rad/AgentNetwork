import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deployAgentToken } from '@/lib/chain/clanker'
import { privateKeyToAccount } from 'viem/accounts'
import type { Agent } from '@/lib/types'

export async function POST(request: NextRequest) {
  let body: { agentId?: string; private_key?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { agentId, private_key } = body

  if (!agentId) {
    return Response.json({ error: 'agentId is required' }, { status: 400 })
  }

  if (!private_key || !private_key.startsWith('0x')) {
    return Response.json(
      { error: 'private_key is required (hex string starting with 0x). The agent deploys its own token.' },
      { status: 400 },
    )
  }

  const typedPrivateKey = private_key as `0x${string}`

  // Load agent from DB
  const { data: agent, error: fetchError } = await supabaseAdmin
    .from('agents')
    .select('id, display_name, token_symbol, token_address, wallet_address')
    .eq('id', agentId)
    .maybeSingle()

  if (fetchError || !agent) {
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

  if (!typedAgent.token_symbol) {
    return Response.json(
      { error: 'Agent has no token_symbol configured' },
      { status: 400 },
    )
  }

  // Idempotency: if already deployed, return existing info
  if (typedAgent.token_address) {
    return Response.json({
      agentId: typedAgent.id,
      symbol: typedAgent.token_symbol,
      tokenAddress: typedAgent.token_address,
      message: 'Agent already has a deployed token',
    })
  }

  try {
    const { tokenAddress, txHash } = await deployAgentToken(
      `${typedAgent.display_name} Token`,
      typedAgent.token_symbol,
      typedPrivateKey,
    )

    await supabaseAdmin
      .from('agents')
      .update({ token_address: tokenAddress, updated_at: new Date().toISOString() })
      .eq('id', typedAgent.id)

    return Response.json(
      {
        agentId: typedAgent.id,
        symbol: typedAgent.token_symbol,
        tokenAddress,
        txHash,
        uniswapUrl: `https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${tokenAddress}&chain=base`,
        baseScanUrl: `https://basescan.org/token/${tokenAddress}`,
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { error: 'Token deployment failed', details: message },
      { status: 502 },
    )
  }
}
