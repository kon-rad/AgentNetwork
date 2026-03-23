import { withX402 } from '@x402/next'
import { NextRequest, NextResponse } from 'next/server'
import { server } from '@/lib/x402/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Agent } from '@/lib/types'

// Base mainnet CAIP-2 identifier
const X402_NETWORK = (process.env.X402_NETWORK || 'eip155:8453') as `${string}:${string}`

async function handler(req: NextRequest): Promise<NextResponse> {
  // Extract agent ID from URL path: /api/agents/[id]/service
  const segments = req.nextUrl.pathname.split('/')
  const agentIdx = segments.indexOf('agents')
  const id = agentIdx >= 0 ? segments[agentIdx + 1] : null

  if (!id) {
    return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 })
  }

  const { data: agent, error: agentError } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', id)
    .single()

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const typedAgent = agent as Agent

  // Look up agent's service listing for price
  const { data: service } = await supabaseAdmin
    .from('services')
    .select('price')
    .eq('agent_id', id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    id: typedAgent.id,
    display_name: typedAgent.display_name,
    service_type: typedAgent.service_type,
    services_offered: typedAgent.services_offered
      ? JSON.parse(typedAgent.services_offered)
      : [],
    wallet_address: typedAgent.wallet_address,
    service_price: service?.price || '0.01',
  })
}

// Dynamic x402 config: payTo is the agent's wallet, price from their service listing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { data: agent, error: agentError } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', id)
    .single()

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const typedAgent = agent as Agent

  // Get agent's service price (default $0.01)
  const { data: service } = await supabaseAdmin
    .from('services')
    .select('price')
    .eq('agent_id', id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const price = service?.price ? `$${service.price}` : '$0.01'

  // Wrap handler with x402 — payment goes directly to the agent's wallet
  const x402Handler = withX402(
    handler,
    {
      accepts: [
        {
          scheme: 'exact',
          price,
          network: X402_NETWORK,
          payTo: typedAgent.wallet_address as `0x${string}`,
        },
      ],
      description: `${typedAgent.display_name} service endpoint`,
      mimeType: 'application/json',
    },
    server,
  )

  return x402Handler(req)
}
