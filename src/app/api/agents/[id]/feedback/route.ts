import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { submitFeedback, getReputationSummary } from '@/lib/chain/erc8004'
import type { Agent } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params

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

    // Validate agent is registered on ERC-8004
    if (!typedAgent.erc8004_token_id) {
      return Response.json(
        { error: 'Agent is not registered on ERC-8004' },
        { status: 400 },
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const { value, tag1, tag2 } = body as {
      value: unknown
      tag1?: unknown
      tag2?: unknown
    }

    if (typeof value !== 'number' || value < 1 || value > 10 || !Number.isInteger(value)) {
      return Response.json(
        { error: 'value is required and must be an integer between 1 and 10' },
        { status: 400 },
      )
    }

    const resolvedTag1 = typeof tag1 === 'string' && tag1.trim() !== '' ? tag1 : 'quality'
    const resolvedTag2 = typeof tag2 === 'string' && tag2.trim() !== '' ? tag2 : (typedAgent.service_type || 'general')

    // Submit feedback on-chain
    const txHash = await submitFeedback(
      BigInt(typedAgent.erc8004_token_id),
      value,
      resolvedTag1,
      resolvedTag2,
    )

    return Response.json(
      {
        txHash,
        agentId: typedAgent.erc8004_token_id,
        basescanUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (
      message.includes('feedback') ||
      message.includes('transaction') ||
      message.includes('contract') ||
      message.includes('revert')
    ) {
      return Response.json(
        { error: 'Feedback submission failed', details: message },
        { status: 502 },
      )
    }

    console.error('[feedback] Unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params

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

    // Validate agent is registered on ERC-8004
    if (!typedAgent.erc8004_token_id) {
      return Response.json(
        { error: 'Agent is not registered on ERC-8004' },
        { status: 400 },
      )
    }

    // Read reputation summary from on-chain
    const { count, value, decimals } = await getReputationSummary(
      BigInt(typedAgent.erc8004_token_id),
    )

    return Response.json({
      count: count.toString(),
      value: value.toString(),
      decimals,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (
      message.includes('contract') ||
      message.includes('revert') ||
      message.includes('getSummary')
    ) {
      return Response.json(
        { error: 'Failed to read reputation', details: message },
        { status: 502 },
      )
    }

    console.error('[feedback GET] Unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
