import { requireOwnership } from '@/lib/auth/guard'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const { id: agentId, sessionId } = await params

  const ownerOrError = await requireOwnership(agentId)
  if (ownerOrError instanceof Response) return ownerOrError

  let query = supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })

  if (sessionId === '__legacy__') {
    query = query.is('session_id', null)
  } else {
    query = query.eq('session_id', sessionId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch session messages:', error)
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  return Response.json(data ?? [])
}
