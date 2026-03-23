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
        'x-shared-secret': nanoclawSecret,
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

  // Transform NanoClaw's {text,done} protocol to client's {type,content} protocol
  const reader = upstreamResponse.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  const stream = new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        // Pass through SSE comments (heartbeats)
        if (line.startsWith(':')) {
          controller.enqueue(encoder.encode(line + '\n'))
          continue
        }
        // Pass through empty lines (SSE event delimiter)
        if (line === '') {
          controller.enqueue(encoder.encode('\n'))
          continue
        }
        // Translate data lines
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6))
            // Already in client format — pass through
            if (payload.type) {
              controller.enqueue(encoder.encode(line + '\n'))
            } else if (payload.done === true) {
              controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
            } else if (payload.text) {
              const translated = JSON.stringify({ type: 'response', content: payload.text })
              controller.enqueue(encoder.encode(`data: ${translated}\n\n`))
            }
          } catch {
            // Pass through unparseable lines
            controller.enqueue(encoder.encode(line + '\n'))
          }
          continue
        }
        // Pass through any other lines
        controller.enqueue(encoder.encode(line + '\n'))
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
