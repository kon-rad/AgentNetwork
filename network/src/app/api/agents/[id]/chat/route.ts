import { requireOwnership } from '@/lib/auth/guard'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params

  const ownerOrError = await requireOwnership(agentId)
  if (ownerOrError instanceof Response) return ownerOrError

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch chat messages:', error)
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  return Response.json(data ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params

  const ownerOrError = await requireOwnership(agentId)
  if (ownerOrError instanceof Response) return ownerOrError

  let body: { content?: unknown; session_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { content, session_id } = body
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return Response.json({ error: 'content must be a non-empty string' }, { status: 400 })
  }
  if (content.length > 4000) {
    return Response.json({ error: 'content must be 4000 characters or fewer' }, { status: 400 })
  }

  const trimmedContent = content.trim()

  // Persist user message (include session_id if provided)
  const { error: insertError } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      agent_id: agentId,
      role: 'user',
      content: trimmedContent,
      ...(typeof session_id === 'string' ? { session_id } : {}),
    })

  if (insertError) {
    console.error('Failed to insert chat message:', insertError)
    return Response.json({ error: 'Failed to save message' }, { status: 500 })
  }

  // Update session metadata if a real session_id was provided
  if (typeof session_id === 'string' && session_id !== '__legacy__') {
    // Update last_message_at
    await supabaseAdmin
      .from('chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', session_id)

    // Auto-set title from first message if title is still null
    const { data: sessionRow } = await supabaseAdmin
      .from('chat_sessions')
      .select('title')
      .eq('id', session_id)
      .single()

    if (sessionRow && sessionRow.title === null) {
      await supabaseAdmin
        .from('chat_sessions')
        .update({ title: trimmedContent.slice(0, 60) })
        .eq('id', session_id)
    }
  }

  // Forward to NanoClaw (fire-and-forget — non-fatal if it fails)
  try {
    const nanoclawUrl = process.env.NANOCLAW_URL
    const nanoclawSecret = process.env.NANOCLAW_SECRET
    if (nanoclawUrl && nanoclawSecret) {
      const nanoclawRes = await fetch(`${nanoclawUrl}/message`, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          'x-shared-secret': nanoclawSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId, message: trimmedContent, sender: 'user' }),
      })
      if (!nanoclawRes.ok) {
        console.error(
          'NanoClaw /message returned non-OK status:',
          nanoclawRes.status,
          await nanoclawRes.text().catch(() => '')
        )
      }
    } else {
      console.warn('NANOCLAW_URL or NANOCLAW_SECRET not configured — skipping NanoClaw forward')
    }
  } catch (err) {
    // Non-fatal: message is persisted; stream will surface the error to the user
    console.error('Failed to forward message to NanoClaw:', err)
  }

  return Response.json({ ok: true })
}
