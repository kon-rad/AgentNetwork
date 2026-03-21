import { withX402 } from '@x402/next'
import { NextRequest, NextResponse } from 'next/server'
import { server } from '@/lib/x402/server'
import { getDb } from '@/lib/db'
import type { Agent } from '@/lib/types'

async function handler(req: NextRequest): Promise<NextResponse> {
  // Extract agent ID from URL path: /api/agents/[id]/service
  const segments = req.nextUrl.pathname.split('/')
  const agentIdx = segments.indexOf('agents')
  const id = agentIdx >= 0 ? segments[agentIdx + 1] : null

  if (!id) {
    return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 })
  }

  const db = getDb()

  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(id) as Agent | undefined

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: agent.id,
    display_name: agent.display_name,
    service_type: agent.service_type,
    services_offered: agent.services_offered
      ? JSON.parse(agent.services_offered)
      : [],
    wallet_address: agent.wallet_address,
  })
}

export const GET = withX402(
  handler,
  {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.01',
        network: 'eip155:84532', // Base Sepolia
        payTo: process.env.AGENT_PAYMENT_ADDRESS!,
      },
    ],
    description: 'Agent service endpoint',
    mimeType: 'application/json',
  },
  server,
)
