---
title: "fix: Agent chat not receiving responses — SSE protocol mismatch"
type: fix
status: active
date: 2026-03-23
---

# fix: Agent chat not receiving responses — SSE protocol mismatch

## Overview

The agent chat page (`/agent/[id]/chat`) accepts user messages but never displays agent responses. The status indicator gets stuck on "thinking" indefinitely. Root cause: the Next.js SSE client expects a different event protocol than what NanoClaw actually sends.

## Problem Statement

**Symptoms:**
- User sends a message — it appears in the chat (optimistic add works)
- Status changes to "thinking" and stays there forever
- No agent response ever appears
- No visible errors in the UI

**Root cause — SSE protocol mismatch:**

NanoClaw's webapp channel (`agent-server/src/channels/webapp/index.ts:228-233`) sends:
```json
{"text": "response content", "done": false}
{"done": true}
```

The Next.js client (`src/app/agent/[id]/chat/page.tsx:66-108`) expects:
```json
{"type": "thinking"}
{"type": "response", "content": "..."}
{"type": "done"}
```

Since `parsed.type` is always `undefined` in the NanoClaw payloads, every `if` branch is skipped. The streaming content is never set, "done" is never detected, and status stays at "thinking".

## Proposed Solution

Fix the SSE stream proxy (`src/app/api/agents/[id]/chat/stream/route.ts`) to translate NanoClaw's protocol into the format the client expects. This keeps changes minimal — one file — and avoids modifying the NanoClaw server (deployed separately on VPS).

### Implementation

**File: `src/app/api/agents/[id]/chat/stream/route.ts`**

Instead of piping NanoClaw's `ReadableStream` directly to the browser, add a `TransformStream` that:

1. Reads each SSE `data:` line from NanoClaw
2. Parses the JSON payload (`{ text, done }`)
3. Re-emits in the client's expected format:
   - `{ text: "...", done: false }` → `{ type: "response", content: "..." }`
   - `{ done: true }` → `{ type: "done" }`
4. Passes through heartbeat comments (`: heartbeat`) unchanged

```typescript
// Pseudocode for the transform
function translateEvent(nanoclawPayload: { text?: string; done?: boolean }) {
  if (nanoclawPayload.done) {
    return { type: "done" };
  }
  if (nanoclawPayload.text) {
    return { type: "response", content: nanoclawPayload.text };
  }
  return null; // skip unrecognized events
}
```

### Secondary fix — status reset on SSE error

**File: `src/app/agent/[id]/chat/page.tsx`**

The `es.onerror` handler (line 111-118) closes and reconnects but never resets `status` back to `"idle"`. If the stream errors after the client set status to "thinking" (from `handleSend`), the UI stays stuck.

```typescript
// current
es.onerror = () => {
  es.close();
  // ... reconnect
};

// fix: reset status
es.onerror = () => {
  es.close();
  setStatus("idle");           // <-- add this
  setStreamingContent("");     // <-- clear any partial content
  streamingContentRef.current = "";
  // ... reconnect
};
```

## Acceptance Criteria

- [ ] Sending a message in `/agent/[id]/chat` displays the agent's response
- [ ] Status indicator transitions: idle → thinking → idle (after response)
- [ ] Streaming content appears in real-time as NanoClaw streams it
- [ ] Status resets to idle if SSE stream errors or disconnects
- [ ] No changes required to the NanoClaw agent-server

## MVP

### `src/app/api/agents/[id]/chat/stream/route.ts`

Replace the direct pipe with a translating transform stream:

```typescript
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
      headers: { 'x-shared-secret': nanoclawSecret },
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
        if (line.startsWith(': ')) {
          // Pass through heartbeat comments
          controller.enqueue(new TextEncoder().encode(line + '\n'))
          continue
        }
        if (!line.startsWith('data: ')) {
          if (line === '') controller.enqueue(new TextEncoder().encode('\n'))
          continue
        }
        try {
          const payload = JSON.parse(line.slice(6))
          if (payload.done === true) {
            controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'))
          } else if (payload.text) {
            const translated = JSON.stringify({ type: 'response', content: payload.text })
            controller.enqueue(new TextEncoder().encode(`data: ${translated}\n\n`))
          } else if (payload.type) {
            // Already in client format — pass through
            controller.enqueue(new TextEncoder().encode(line + '\n'))
          }
        } catch {
          // Pass through unparseable lines
          controller.enqueue(new TextEncoder().encode(line + '\n'))
        }
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
```

### `src/app/agent/[id]/chat/page.tsx` — onerror fix

```typescript
es.onerror = () => {
  es.close();
  esRef.current = null;
  setStatus("idle");
  setStreamingContent("");
  streamingContentRef.current = "";
  setTimeout(() => {
    if (!cancelled) openEventSource();
  }, 3000);
};
```

## Sources

- NanoClaw SSE protocol: `agent-server/src/channels/webapp/index.ts:227-234`
- Next.js SSE proxy: `src/app/api/agents/[id]/chat/stream/route.ts`
- Next.js SSE client: `src/app/agent/[id]/chat/page.tsx:62-118`
- Chat POST handler: `src/app/api/agents/[id]/chat/route.ts:63-90`
