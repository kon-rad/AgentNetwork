import { requireOwnership } from '@/lib/auth/guard'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params

  const ownerOrError = await requireOwnership(agentId)
  if (ownerOrError instanceof Response) return ownerOrError

  const { data: sessions, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, created_at, last_message_at')
    .eq('agent_id', agentId)
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Failed to fetch chat sessions:', error)
    return Response.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  // Check for orphaned messages (session_id IS NULL)
  const { count } = await supabaseAdmin
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .is('session_id', null)

  const result = sessions ?? []

  if (count && count > 0) {
    // Get earliest orphaned message timestamp
    const { data: earliest } = await supabaseAdmin
      .from('chat_messages')
      .select('created_at')
      .eq('agent_id', agentId)
      .is('session_id', null)
      .order('created_at', { ascending: true })
      .limit(1)

    // Get latest orphaned message timestamp
    const { data: latest } = await supabaseAdmin
      .from('chat_messages')
      .select('created_at')
      .eq('agent_id', agentId)
      .is('session_id', null)
      .order('created_at', { ascending: false })
      .limit(1)

    const legacySession = {
      id: '__legacy__',
      title: 'Previous messages',
      created_at: earliest?.[0]?.created_at ?? null,
      last_message_at: latest?.[0]?.created_at ?? null,
    }

    result.unshift(legacySession)
  }

  return Response.json(result)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params

  const ownerOrError = await requireOwnership(agentId)
  if (ownerOrError instanceof Response) return ownerOrError

  const { data: session, error } = await supabaseAdmin
    .from('chat_sessions')
    .insert({ agent_id: agentId })
    .select()
    .single()

  if (error) {
    console.error('Failed to create chat session:', error)
    return Response.json({ error: 'Failed to create session' }, { status: 500 })
  }

  return Response.json(session)
}
