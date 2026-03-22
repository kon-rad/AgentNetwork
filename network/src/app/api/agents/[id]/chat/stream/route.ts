import { requireOwnership } from '@/lib/auth/guard'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params

  const ownerOrError = await requireOwnership(agentId)
  if (ownerOrError instanceof Response) return ownerOrError

  const nanoclawUrl = process.env.NANOCLAW_URL
  const nanoclawSecret = process.env.NANOCLAW_SECRET

  if (!nanoclawUrl || !nanoclawSecret) {
    // Return a synthetic SSE error event and close
    const errorBody = 'data: {"type":"error","message":"NanoClaw not configured"}\n\ndata: {"type":"done"}\n\n'
    return new Response(errorBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(`${nanoclawUrl}/stream/${agentId}`, {
      headers: {
        'Authorization': `Bearer ${nanoclawSecret}`,
      },
    })
  } catch (err) {
    console.error('Failed to connect to NanoClaw stream:', err)
    const errorBody = 'data: {"type":"error","message":"Failed to connect to agent stream"}\n\ndata: {"type":"done"}\n\n'
    return new Response(errorBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    console.error('NanoClaw stream returned non-OK status:', upstreamResponse.status)
    const errorBody = `data: {"type":"error","message":"Agent stream unavailable (${upstreamResponse.status})"}\n\ndata: {"type":"done"}\n\n`
    return new Response(errorBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // Pipe upstream ReadableStream directly to the browser
  return new Response(upstreamResponse.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
