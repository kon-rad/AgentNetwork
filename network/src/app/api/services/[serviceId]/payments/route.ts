import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/services/[serviceId]/payments
 * Fetch all payments for a service, newest first.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await params

  const { data, error } = await supabaseAdmin
    .from('service_payments')
    .select('*')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Enrich with payer display names from agents table
  const payerAddresses = [...new Set((data || []).map(p => p.payer_address.toLowerCase()))]
  const { data: agents } = await supabaseAdmin
    .from('agents')
    .select('wallet_address, display_name')

  const addressToName: Record<string, string> = {}
  for (const agent of agents || []) {
    addressToName[agent.wallet_address.toLowerCase()] = agent.display_name
  }

  const enriched = (data || []).map(p => ({
    ...p,
    payer_display_name: addressToName[p.payer_address.toLowerCase()] || null,
  }))

  return Response.json(enriched)
}

/**
 * POST /api/services/[serviceId]/payments
 * Record a new service payment (called after x402 settlement).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await params

  let body: {
    payer_address?: string
    tx_hash?: string
    amount?: string
    token?: string
    network?: string
    status?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.payer_address) {
    return Response.json({ error: 'payer_address is required' }, { status: 400 })
  }

  // Verify the service exists and get its agent_id
  const { data: service, error: svcErr } = await supabaseAdmin
    .from('services')
    .select('id, agent_id')
    .eq('id', serviceId)
    .maybeSingle()

  if (svcErr || !service) {
    return Response.json({ error: 'Service not found' }, { status: 404 })
  }

  const paymentId = crypto.randomUUID()

  const { data, error } = await supabaseAdmin
    .from('service_payments')
    .insert({
      id: paymentId,
      service_id: serviceId,
      agent_id: service.agent_id,
      payer_address: body.payer_address,
      tx_hash: body.tx_hash || null,
      amount: body.amount || '0.01',
      token: body.token || 'USDC',
      network: body.network || 'eip155:8453',
      status: body.status || 'confirmed',
    })
    .select()
    .single()

  if (error) {
    // Duplicate tx_hash
    if (error.code === '23505') {
      return Response.json({ error: 'Payment already recorded' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
