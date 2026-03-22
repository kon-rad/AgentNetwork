import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/guard'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params

  // Try to get session — not required, but changes response shape
  const sessionOrError = await requireAuth()

  if (sessionOrError instanceof Response) {
    // Unauthenticated — return public aggregate status only
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('expires_at')
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return Response.json({
      has_active: data !== null,
      expires_at: data?.expires_at ?? null,
    })
  }

  // Authenticated — return full subscription for this wallet
  const session = sessionOrError

  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('owner_wallet', session.address!.toLowerCase())
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return Response.json({ error: 'No active subscription' }, { status: 404 })
  }

  return Response.json(data)
}
