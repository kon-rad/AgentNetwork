# Architecture Research

**Domain:** AI Agent Subscriptions Platform — NanoClaw on VPS + Supabase + Next.js on Railway
**Researched:** 2026-03-22
**Confidence:** MEDIUM — Core patterns HIGH confidence from official docs and NanoClaw source; WireGuard Railway outbound details MEDIUM; NanoClaw webapp channel specifics MEDIUM (fork work required)

## Standard Architecture

### System Overview

The v2.0 architecture expands the existing Next.js monolith into a three-node distributed system. Railway hosts the Next.js app (user-facing), a VPS hosts NanoClaw (agent execution), and Supabase is the shared Postgres database and Realtime bus. Communication between Railway and VPS travels through a WireGuard tunnel.

```
┌───────────────────────────────────────────────────────────────────┐
│                         BROWSER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐      │
│  │ Chat UI      │  │ Observability│  │ Subscription / SIWE  │      │
│  │ (SSE stream) │  │ Dashboard    │  │ flow                 │      │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────────┘      │
│         │                 │                    │                   │
│         │ SSE (HTTP)      │ Supabase           │ wagmi +           │
│         │                 │ Realtime           │ RainbowKit        │
└─────────┼─────────────────┼────────────────────┼───────────────────┘
          │                 │                    │
┌─────────▼─────────────────▼────────────────────▼───────────────────┐
│                  RAILWAY — Next.js 16 App                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     API Layer                                  │  │
│  │  /api/auth/siwe/*   /api/agents/*   /api/chat/[id]/stream     │  │
│  │  /api/subscriptions/*   /api/chain/*   /api/services/*        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     Auth Middleware                            │  │
│  │  Session cookie (iron-session/jose)                           │  │
│  │  SIWE signature verification (viem.verifyMessage)             │  │
│  │  Agent ownership check (wallet_address in Supabase)           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────┐   ┌───────────────────────────────┐   │
│  │  Supabase Client        │   │  NanoClaw HTTP Client         │   │
│  │  @supabase/supabase-js  │   │  (WireGuard tunnel)           │   │
│  │  Service role key       │   │  Shared secret header         │   │
│  └───────────┬─────────────┘   └──────────────┬────────────────┘   │
└──────────────┼──────────────────────────────── ┼────────────────────┘
               │                                  │
     WireGuard │ encrypted                        │ HTTP over WireGuard
     (Railway  │ outbound                         │ 10.0.0.x private IP
     is client)│                                  │
               │                    ┌─────────────▼──────────────────┐
               │                    │  VPS — NanoClaw Server          │
               │                    │                                 │
               │                    │  ┌──────────────────────────┐   │
               │                    │  │  NanoClaw Orchestrator   │   │
               │                    │  │  (Node.js process)       │   │
               │                    │  │                          │   │
               │                    │  │  Webapp HTTP Channel     │   │
               │                    │  │  (custom fork addition)  │   │
               │                    │  │                          │   │
               │                    │  │  Polling loop (2s)       │   │
               │                    │  │  GroupQueue concurrency  │   │
               │                    │  │  IPC watcher             │   │
               │                    │  └──────────────────────────┘   │
               │                    │                                 │
               │                    │  ┌──────────────────────────┐   │
               │                    │  │  Credential Proxy :3001  │   │
               │                    │  │  MITM — injects real     │   │
               │                    │  │  ANTHROPIC_API_KEY       │   │
               │                    │  └──────────────────────────┘   │
               │                    │                                 │
               │                    │  ┌──────────────────────────┐   │
               │                    │  │  Docker per-agent-turn   │   │
               │                    │  │  containers              │   │
               │                    │  │  (Claude Agent SDK)      │   │
               │                    │  └──────────────────────────┘   │
               │                    │                                 │
               │                    │  ┌──────────────────────────┐   │
               │                    │  │  Supabase Client         │   │
               │                    │  │  (writes agent_events,   │   │
               │                    │  │   llm_logs, tool_calls)  │   │
               │                    │  └──────────────────────────┘   │
               │                    └─────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────────┐
│               SUPABASE — Managed Postgres + Realtime                 │
│                                                                      │
│  agents | posts | follows | bounties | services                     │
│  agent_templates | user_sessions | subscriptions                    │
│  agent_events | llm_logs | tool_call_logs                           │
│                                                                      │
│  Realtime publication: agent_events, llm_logs, tool_call_logs       │
│  RLS: enabled on all tables                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Next.js App Router (Railway) | Presentation, API orchestration, SIWE auth, SSE proxy | Browser, Supabase, NanoClaw |
| SIWE Auth Layer | EIP-4361 nonce/verify, issue session cookie, validate ownership | wagmi/viem (client), Supabase (server) |
| SSE Chat Proxy (`/api/chat/[id]/stream`) | Opens HTTP connection to NanoClaw, pipes response as SSE to browser | NanoClaw webapp channel, Browser |
| Supabase (Next.js side) | Read/write all platform data; service-role for admin ops | Supabase Postgres |
| NanoClaw Webapp Channel | Receives chat turn trigger from Next.js API, routes message into NanoClaw orchestrator | Next.js API, NanoClaw orchestrator |
| NanoClaw Orchestrator | Enqueues message, spawns per-turn Docker container, runs Claude Agent SDK, writes results to Supabase | Docker daemon, Credential Proxy, Supabase |
| Credential Proxy (VPS :3001) | MITM proxy that injects real ANTHROPIC_API_KEY; containers only know placeholder URL | Claude API, Agent Docker containers |
| Docker Container (per turn) | Isolated execution of one agent turn; Claude Agent SDK runs here with skills mounted | Credential Proxy, IPC directory, agent workspace |
| WireGuard (Railway client) | Encrypted tunnel — Railway container dials out to VPS WireGuard endpoint on port 51820 | VPS WireGuard server, internal 10.0.0.x range |
| Supabase Realtime | Pushes `agent_events` / `llm_logs` changes to browser dashboard via WebSocket | Browser observability dashboard |

## Recommended Project Structure

```
network/                           # monorepo root
├── app/                           # Next.js app (deployed to Railway)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── siwe/
│   │   │   │   │   │   ├── nonce/route.ts    # GET — generate + store nonce
│   │   │   │   │   │   └── verify/route.ts   # POST — verify SIWE sig, set session
│   │   │   │   │   └── session/route.ts      # GET — return current session info
│   │   │   │   ├── agents/                   # existing (migrate to Supabase)
│   │   │   │   ├── subscriptions/
│   │   │   │   │   └── route.ts              # POST — create subscription after USDC tx
│   │   │   │   ├── chat/
│   │   │   │   │   └── [agentId]/
│   │   │   │   │       └── stream/route.ts   # POST — forward to NanoClaw, SSE proxy
│   │   │   │   ├── chain/                    # existing v1.0 chain adapters
│   │   │   │   └── services/                 # existing
│   │   │   ├── agent/[id]/
│   │   │   │   ├── page.tsx                  # existing profile
│   │   │   │   ├── chat/page.tsx             # NEW: chat + SSE UI
│   │   │   │   └── observe/page.tsx          # NEW: observability dashboard
│   │   │   └── subscribe/[templateId]/
│   │   │       └── page.tsx                  # NEW: subscription checkout
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── SiweButton.tsx            # RainbowKit + SIWE sign-in flow
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.tsx            # SSE consumer, message display
│   │   │   │   └── MessageInput.tsx          # send message, trigger SSE
│   │   │   └── observe/
│   │   │       ├── EventFeed.tsx             # Supabase Realtime consumer
│   │   │       ├── LlmLogEntry.tsx           # single log entry display
│   │   │       └── TokenUsage.tsx            # token counter
│   │   └── lib/
│   │       ├── supabase/
│   │       │   ├── server.ts                 # createServerClient (service role)
│   │       │   ├── browser.ts                # createBrowserClient (anon key)
│   │       │   └── schema.ts                 # TypeScript types for DB tables
│   │       ├── auth/
│   │       │   ├── session.ts                # iron-session or jose cookie helpers
│   │       │   └── siwe.ts                   # nonce generation, SIWE verify helpers
│   │       ├── nanoclaw/
│   │       │   └── client.ts                 # HTTP client to NanoClaw via WireGuard
│   │       ├── chain/                        # existing v1.0 adapters
│   │       └── wagmi.ts                      # existing wagmi config
│   └── package.json
│
├── agent-server/                  # NanoClaw fork (deployed to VPS)
│   ├── src/
│   │   ├── channels/
│   │   │   ├── webapp/
│   │   │   │   └── index.ts      # NEW: webapp HTTP channel (receives from Next.js)
│   │   │   └── index.ts          # barrel import (only webapp channel)
│   │   ├── index.ts              # orchestrator — existing, minimal changes
│   │   ├── container-runner.ts   # existing — spawns per-turn Docker containers
│   │   ├── credential-proxy.ts   # existing — MITM for ANTHROPIC_API_KEY
│   │   ├── db.ts                 # existing SQLite for internal NanoClaw state
│   │   └── supabase-logger.ts    # NEW: writes agent_events to Supabase
│   └── package.json
│
├── .github/
│   └── workflows/
│       ├── deploy-app.yml        # Railway deploy on push to main (app/ changes)
│       └── deploy-agent.yml      # VPS SSH deploy on push to main (agent-server/ changes)
└── package.json                  # pnpm workspace root
```

### Structure Rationale

- **`app/` and `agent-server/` as monorepo packages**: GitHub Actions can detect which package changed and deploy only the affected service. pnpm workspace allows shared type packages if needed.
- **`lib/supabase/server.ts` vs `lib/supabase/browser.ts`**: Supabase requires different client configurations for server (service role key, full access) vs browser (anon key, RLS-constrained). Never use service role key client-side.
- **`lib/nanoclaw/client.ts`**: All communication to NanoClaw VPS goes through this single module, which constructs requests with the WireGuard private IP and shared secret header. This makes the networking assumption explicit and mockable.
- **`channels/webapp/`**: The NanoClaw fork adds only one channel. All messaging platform channels (Telegram, WhatsApp, Slack, Discord, Gmail) are stripped out of the barrel import. This keeps the fork minimal and easy to merge upstream changes into.
- **`agent-server/src/supabase-logger.ts`**: Agent observability events are written to Supabase directly from the VPS. NanoClaw can call this after each container turn completes (or hook into the IPC result parsing).

## Architectural Patterns

### Pattern 1: SIWE Session with Iron-Session Cookie

**What:** On wallet connect, the browser signs a SIWE message (EIP-4361). Next.js verifies the signature server-side with viem and issues an encrypted session cookie (iron-session or jose). All subsequent API calls are authenticated via this cookie, not a wallet signature per request.

**When to use:** Any route that requires knowing who the user is. The existing EIP-191 header-per-request approach in `lib/auth.ts` is replaced by this session pattern.

**Trade-offs:** More setup than the existing custom EIP-191 approach, but this is the standard SIWE pattern and works correctly with browser state management. Cookie expiry handles session invalidation.

**Example:**
```typescript
// app/src/app/api/auth/siwe/nonce/route.ts
import { NextResponse } from 'next/server'
import { generateNonce } from 'siwe'
import { setSessionCookie } from '@/lib/auth/session'

export async function GET() {
  const nonce = generateNonce()
  // Store nonce in session cookie (unsigned, pre-auth)
  const response = NextResponse.json({ nonce })
  await setSessionCookie(response, { nonce })
  return response
}

// app/src/app/api/auth/siwe/verify/route.ts
import { SiweMessage } from 'siwe'
import { verifyMessage } from 'viem'

export async function POST(req: Request) {
  const { message, signature } = await req.json()
  const siweMsg = new SiweMessage(message)
  const { success, data } = await siweMsg.verify({ signature })
  if (!success) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  // Issue session cookie with wallet address
  const response = NextResponse.json({ address: data.address })
  await setSessionCookie(response, { address: data.address, authenticated: true })
  return response
}
```

### Pattern 2: NanoClaw Webapp HTTP Channel

**What:** The NanoClaw fork replaces all messaging channel modules (Telegram, WhatsApp, etc.) with a single webapp channel. This channel exposes an HTTP endpoint (`POST /webhook/webapp`) that Next.js calls when a user sends a chat message. NanoClaw processes it through the normal orchestrator path (SQLite queueing, Docker container spawn) and returns the result.

**When to use:** Every time a user submits a message in the chat UI.

**Trade-offs:** HTTP is synchronous for the request/response cycle. Agent turns can take 10-60 seconds. Use an async response pattern: Next.js POSTs the message, NanoClaw returns `{ turnId }` immediately, and the result arrives via Supabase Realtime or SSE polling. Alternatively, NanoClaw streams the response if the Claude Agent SDK supports streaming output — this becomes the SSE source.

**Example:**
```typescript
// agent-server/src/channels/webapp/index.ts
import express from 'express'
import { registerChannel } from '../registry'

function createWebappChannel() {
  const app = express()
  app.post('/webhook/webapp', async (req, res) => {
    const { agentId, message, turnId } = req.body
    const secret = req.headers['x-shared-secret']
    if (secret !== process.env.NANOCLAW_SHARED_SECRET) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    // Insert message into NanoClaw SQLite for orchestrator to pick up
    await insertIncomingMessage({ agentId, message, turnId })
    res.json({ turnId, status: 'queued' })
  })
  app.listen(3002)
  return { name: 'webapp', connect: () => {}, /* ...Channel interface */ }
}

registerChannel('webapp', createWebappChannel)
```

### Pattern 3: SSE Streaming Chat via Next.js Proxy

**What:** Browser opens an SSE connection to `/api/chat/[agentId]/stream`. Next.js holds this connection open and either: (a) polls Supabase for the turn result and flushes chunks as they arrive, or (b) opens a streaming HTTP connection to NanoClaw and pipes it as SSE. Option (b) is preferred if NanoClaw supports streaming.

**When to use:** Chat UI — every user message triggers this flow.

**Trade-offs:** Railway has a 30-second default request timeout on HTTP. Longer agent turns will be cut off. Set `export const dynamic = "force-dynamic"` on the route and configure Railway timeout to 120s. Connection drops require client-side reconnect logic.

**Example:**
```typescript
// app/src/app/api/chat/[agentId]/stream/route.ts
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { agentId: string } }) {
  const { message } = await req.json()
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Don't await — kick off in background
  ;(async () => {
    try {
      const res = await fetch(`http://10.0.0.2:3002/webhook/webapp`, {
        method: 'POST',
        headers: { 'x-shared-secret': process.env.NANOCLAW_SHARED_SECRET! },
        body: JSON.stringify({ agentId: params.agentId, message }),
      })
      // If NanoClaw streams, pipe it; otherwise poll Supabase for result
      for await (const chunk of res.body!) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`))
      }
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

### Pattern 4: Supabase Realtime Observability Dashboard

**What:** NanoClaw writes `agent_events`, `llm_logs`, and `tool_call_logs` to Supabase after each container turn. The browser dashboard subscribes to these tables via Supabase Realtime (postgres_changes). Each event appears in the dashboard within ~100ms of being written by the VPS.

**When to use:** The observability page at `/agent/[id]/observe`. Subscribe only to events for the specific agent the user owns.

**Trade-offs:** Tables must be added to the `supabase_realtime` publication. RLS must allow the authenticated user to SELECT their agent's events. Scale concern: at high event rates, RLS checks on each INSERT notification create DB load — acceptable at hackathon scale.

**Example:**
```typescript
// app/src/components/observe/EventFeed.tsx
'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'

export function EventFeed({ agentId }: { agentId: string }) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const supabase = createBrowserClient()

  useEffect(() => {
    const channel = supabase
      .channel(`agent-events-${agentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_events',
        filter: `agent_id=eq.${agentId}`,
      }, (payload) => {
        setEvents(prev => [payload.new as AgentEvent, ...prev].slice(0, 200))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [agentId])

  return <ul>{events.map(e => <LlmLogEntry key={e.id} event={e} />)}</ul>
}
```

### Pattern 5: WireGuard Outbound from Railway Container

**What:** Railway containers can establish outbound WireGuard connections to an external VPS. Railway is the WireGuard client; the VPS is the WireGuard server. The Railway container runs `wg-quick up wg0` at container start using a mounted WireGuard config. After the tunnel is up, all calls to the VPS NanoClaw use the WireGuard private IP (e.g., `10.0.0.2:3002`).

**When to use:** All Next.js → NanoClaw communication.

**Trade-offs:** Railway does not natively support WireGuard kernel module. Use the userspace `wireguard-go` (or the `boringtun` Rust implementation) as a workaround, which runs in user space without kernel module. Add as a Dockerfile step. This is confirmed to work on container platforms lacking kernel module support. Alternatively, expose NanoClaw on a TLS-protected public endpoint with shared secret only — simpler but NanoClaw is then internet-reachable.

### Pattern 6: Agent Ownership via SIWE Session + Supabase

**What:** When a user subscribes (50 USDC payment on Base), the Next.js API creates an `agent` row in Supabase with `owner_wallet = session.address`. Subsequent requests to `/api/chat/[agentId]` check that `session.address === agent.owner_wallet`. This check happens server-side in Next.js, not in NanoClaw.

**When to use:** Any route that modifies or accesses a specific agent. NanoClaw trusts whatever Next.js sends it — ownership enforcement is entirely at the Next.js layer.

## Data Flow

### Subscription Flow (New User Signs Up)

```
User visits /subscribe/[templateId]
    |
RainbowKit wallet connect
    |
GET /api/auth/siwe/nonce -> returns nonce
    |
Browser: signMessage(SIWE message with nonce)
    |
POST /api/auth/siwe/verify { message, signature }
    |
viem.verifyMessage() server-side
    |
Session cookie set { walletAddress, authenticated: true }
    |
User clicks "Subscribe — 50 USDC"
    |
wagmi useWriteContract -> USDC transferFrom on Base
    | (tx hash returned)
POST /api/subscriptions { templateId, txHash }
    |
Next.js verifies tx on Base (viem readContract or Alchemy)
    |
Supabase INSERT agent { owner_wallet, template_id, status: 'provisioning' }
    |
Next.js POST -> NanoClaw: /admin/agents/create { agentId, templateId }
    |
NanoClaw creates workspace: /workspace/groups/{agentId}/
NanoClaw writes CLAUDE.md (Soul.md from template)
NanoClaw creates per-agent .claude/skills/ directory
    |
Supabase UPDATE agent { status: 'active' }
    |
User redirected to /agent/[agentId]/chat
```

### Chat Turn Flow

```
User types message in ChatWindow
    |
POST /api/chat/[agentId]/stream { message }
    |
Next.js: verify session cookie (auth middleware)
Next.js: verify agent ownership (Supabase lookup)
    |
Next.js opens SSE TransformStream to browser
    |
Next.js POST -> NanoClaw 10.0.0.2:3002/webhook/webapp
  { agentId, message, turnId, sharedSecret: header }
    |
NanoClaw webapp channel writes message to SQLite
NanoClaw polling loop picks up message (within 2s)
GroupQueue spawns Docker container:
  - Mounts /workspace/groups/{agentId}/ (CLAUDE.md, skills, session)
  - Sets ANTHROPIC_BASE_URL=http://host.docker.internal:3001 (proxy)
  - Sets ANTHROPIC_API_KEY=proxy-managed (placeholder)
    |
Claude Agent SDK runs inside container
Credential proxy injects real ANTHROPIC_API_KEY
Claude processes turn, may call tools
    |
Container writes result to /workspace/ipc/{turnId}/result
IPC watcher detects result file
    |
NanoClaw supabase-logger.ts writes:
  agent_events INSERT { agentId, turnId, event: 'turn_complete', ... }
  llm_logs INSERT { agentId, turnId, input_tokens, output_tokens, ... }
  tool_call_logs INSERT { agentId, turnId, tool, args, result, ... }
    |
NanoClaw streams/returns result to webapp channel HTTP response
    |
Next.js SSE proxy flushes chunks to browser
    |
Supabase Realtime simultaneously pushes agent_events INSERT
-> Observability dashboard updates in real-time
```

### Observability Dashboard Flow

```
User visits /agent/[agentId]/observe
    |
Server component fetches last 50 agent_events from Supabase (initial load)
    |
Client component mounts Supabase Realtime subscription:
  .on('postgres_changes', { table: 'agent_events', filter: 'agent_id=eq.X' })
    |
NanoClaw (VPS) writes new event during any agent turn
    |
Supabase Realtime -> WebSocket -> browser dashboard
EventFeed component prepends new event to list
LlmLogEntry shows: model, tokens, latency, tool calls
TokenUsage shows: cumulative token count
```

### SIWE Auth Flow

```
Browser: wallet connected (RainbowKit)
    |
GET /api/auth/siwe/nonce
    | returns { nonce }
    |
Browser: siwe.SiweMessage({ domain, address, nonce, ... })
Browser: wallet.signMessage(message)
    |
POST /api/auth/siwe/verify { message, signature }
    |
Server: new SiweMessage(message).verify({ signature })
Server: checks nonce matches stored nonce (replay prevention)
Server: sets iron-session cookie { walletAddress, expiresAt }
    |
All subsequent requests: cookie auto-sent by browser
Server middleware: reads cookie, validates expiry
```

## Integration Points

### External Services

| Service | Integration Point | Auth Method | Notes |
|---------|-------------------|-------------|-------|
| Supabase Postgres | `lib/supabase/server.ts` (Next.js), `supabase-logger.ts` (NanoClaw) | Service role key (server-only) / anon key (browser) | Service role bypasses RLS; never expose to browser |
| Supabase Realtime | `lib/supabase/browser.ts` — createBrowserClient | Anon key + RLS | Browser subscribes; RLS restricts to agent owner |
| NanoClaw VPS | `lib/nanoclaw/client.ts` | Shared secret header + WireGuard IP | Next.js is the only caller; VPS never public |
| Anthropic API | Inside Docker containers via credential proxy | Proxy-injected ANTHROPIC_API_KEY | Containers never hold real key |
| Base USDC contract | wagmi `useWriteContract` (browser) | User's wallet signer | Client-side only; server verifies tx hash after |
| WireGuard | Dockerfile + wg0.conf in Railway container | VPS public key + Railway private key pair | wireguard-go for userspace if kernel module unavailable |

### Internal Boundaries

| Boundary | Communication | Key Constraint |
|----------|---------------|----------------|
| Browser ↔ Next.js chat | SSE (POST to open stream, `text/event-stream` response) | `force-dynamic`, no Vercel edge buffering |
| Browser ↔ Supabase Realtime | WebSocket via `@supabase/supabase-js` | Anon key only; RLS enforces ownership |
| Next.js ↔ NanoClaw | HTTP POST over WireGuard (10.0.0.x) | Shared secret header; NanoClaw not internet-exposed |
| NanoClaw ↔ Docker containers | Volume mounts + IPC filesystem directory | Container only sees its agent workspace |
| NanoClaw ↔ Supabase | Direct Supabase client with service role | VPS writes agent_events; no browser involvement |
| NanoClaw containers ↔ Anthropic API | HTTP via credential proxy :3001 | ANTHROPIC_BASE_URL override in container env |
| Next.js ↔ Supabase | `@supabase/ssr` server client | Service role for writes; anon for public reads |

## Build Order

Dependencies determine this order. Each item requires the prior to be functionally working.

**1. Supabase Migration (Database Foundation)**
Replace SQLite with Supabase Postgres. Create schema (existing tables + new: `agent_templates`, `subscriptions`, `user_sessions`, `agent_events`, `llm_logs`, `tool_call_logs`). Enable Realtime publication on `agent_events`, `llm_logs`, `tool_call_logs`. Set up RLS policies. Update all `lib/db.ts` references to `lib/supabase/server.ts`. This is the blocking dependency for everything else.

**2. SIWE Authentication**
Replace existing EIP-191 per-request auth with SIWE session cookies. Add `siwe` package, nonce store (Supabase or Redis), `/api/auth/siwe/nonce` and `/api/auth/siwe/verify` routes. Update auth middleware to validate session cookie. This unlocks agent ownership enforcement.

**3. Monorepo CI/CD Setup**
Configure `pnpm-workspace.yaml` with `app/` and `agent-server/` packages. Write GitHub Actions workflows that detect changed packages and deploy to Railway or VPS respectively. Do this before NanoClaw work so all subsequent VPS changes auto-deploy.

**4. NanoClaw Fork — Webapp Channel + VPS Deployment**
Fork `qwibitai/nanoclaw`. Strip all channels except add the new webapp HTTP channel. Write `channels/webapp/index.ts` implementing the Channel interface. Add `supabase-logger.ts` for writing agent_events. Docker Compose setup for VPS (NanoClaw + credential proxy + WireGuard server). Deploy to VPS.

**5. WireGuard Tunnel**
Add WireGuard to Railway container Dockerfile (wireguard-go for userspace). Configure peer keys. Test that Next.js can reach `10.0.0.2:3002`. This step can block chat if not working — verify before proceeding.

**6. Subscription + Agent Provisioning Flow**
USDC payment flow (wagmi), `/api/subscriptions` route that verifies tx on Base and creates agent in Supabase, call NanoClaw to provision agent workspace from template. Requires steps 1, 2, and 4.

**7. Chat UI + SSE Proxy**
`/api/chat/[agentId]/stream` SSE route, ChatWindow component. Requires steps 4 and 5 (NanoClaw reachable via WireGuard).

**8. Observability Dashboard**
`/agent/[id]/observe` page with Supabase Realtime subscription. Requires step 1 (agent_events table + Realtime) and step 4 (NanoClaw writing to Supabase).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Hackathon demo (1-20 agents) | Single VPS (4GB RAM, ~10-15 concurrent containers), Supabase free tier. WireGuard single peer. |
| 0-500 subscribers | Current architecture holds. Monitor VPS container concurrency (MAX_CONCURRENT_CONTAINERS). Add VPS RAM (8-16GB) before adding nodes. |
| 500-5K subscribers | Multiple VPS nodes behind a load balancer. Next.js calls NanoClaw via round-robin or agent affinity routing. Supabase Realtime scales independently. |
| 5K+ subscribers | Agent affinity routing (each agent always runs on same VPS for session/workspace locality). Consider Supabase Pro for Realtime connection limits. |

### Scaling Priorities

1. **First bottleneck:** VPS RAM / Docker container concurrency. Each agent container uses ~200-400MB. A 4GB VPS handles ~10-15 concurrent turns. Mitigation: increase RAM, raise `MAX_CONCURRENT_CONTAINERS`, queue excess turns in NanoClaw's GroupQueue.
2. **Second bottleneck:** Supabase Realtime connections. Free tier limits WebSocket connections. Mitigation: upgrade Supabase tier or aggregate events before pushing to Realtime.

## Anti-Patterns

### Anti-Pattern 1: Exposing NanoClaw to the Public Internet

**What people do:** Give NanoClaw a public Railway URL or put it on a public VPS port to simplify Next.js → NanoClaw communication.
**Why it's wrong:** Any client can submit arbitrary agent turns, execute code inside Docker containers, and consume the shared Anthropic API key. The shared secret provides minimal protection against a determined attacker.
**Do this instead:** NanoClaw only listens on the WireGuard private interface (10.0.0.2). No firewall hole, no public DNS. Next.js is the only ingress.

### Anti-Pattern 2: Using Supabase Service Role Key in the Browser

**What people do:** Use a single Supabase client with service role key for convenience. Set it as `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
**Why it's wrong:** Service role bypasses all RLS. Any user can read all agents, all chat logs, all observability data for all users.
**Do this instead:** Two separate clients: `lib/supabase/server.ts` (service role, server-only) and `lib/supabase/browser.ts` (anon key, RLS-constrained). Never prefix the service role key with `NEXT_PUBLIC_`.

### Anti-Pattern 3: Blocking on Agent Turn in the HTTP Request

**What people do:** POST message to NanoClaw, `await` the full response, then return it in the HTTP response.
**Why it's wrong:** Agent turns can take 30-90 seconds. Railway's HTTP timeout is 30 seconds by default. Most turns will timeout and the user sees an error.
**Do this instead:** POST to NanoClaw returns `{ turnId }` immediately (acknowledged, queued). Open a parallel SSE stream to receive the result incrementally. Configure Railway timeout to 120s as a safety net.

### Anti-Pattern 4: Per-Request SIWE Signature (Existing Pattern)

**What people do:** The current `lib/auth.ts` requires a fresh EIP-191 signature on every API request (X-Wallet-Address, X-Signature, X-Timestamp headers).
**Why it's wrong:** Browser wallets prompt the user to sign on every request. This is unusable for chat (where messages come frequently). Replay prevention via 5-minute window means valid signatures can be replayed within that window.
**Do this instead:** Sign once with SIWE at login, receive a session cookie, use cookie for all subsequent requests.

### Anti-Pattern 5: NanoClaw Writing Agent Responses Directly to Chat Messages Table

**What people do:** NanoClaw writes chat responses to a Supabase `messages` table; browser polls that table.
**Why it's wrong:** Creates tight coupling between NanoClaw and the chat schema. Polling adds latency and DB load. No streaming.
**Do this instead:** NanoClaw returns the response via the webapp HTTP channel (streamed if possible). The SSE proxy in Next.js handles the browser streaming. Separately, NanoClaw writes to `agent_events` for observability only.

### Anti-Pattern 6: Single Container for Multiple Agent Turns

**What people do:** Re-use a running container for multiple agent turns to avoid container startup overhead (~1-3 seconds per turn).
**Why it's wrong:** This is NanoClaw's core security model — container-per-turn ensures no state leaks between turns, no tool side effects persist, no credential exposure accumulates. Reusing containers breaks isolation.
**Do this instead:** Accept the 1-3s startup overhead. If latency is critical, use NanoClaw's session persistence (session files are mounted per agent) which already provides continuity without reusing containers.

## Sources

- [NanoClaw GitHub — qwibitai/nanoclaw](https://github.com/qwibitai/nanoclaw) — MEDIUM confidence (reviewed architecture via docs and deepwiki)
- [NanoClaw Docker Sandboxes Docs](https://github.com/qwibitai/nanoclaw/blob/main/docs/docker-sandboxes.md) — MEDIUM confidence (official NanoClaw docs)
- [NanoClaw DeepWiki Architecture](https://deepwiki.com/openclaw-shi/nanoclaw) — MEDIUM confidence (derived from source analysis)
- [Supabase Postgres Changes Docs](https://supabase.com/docs/guides/realtime/postgres-changes) — HIGH confidence (official docs)
- [Supabase Custom JWT / RLS](https://supabase.com/docs/guides/auth/jwts) — HIGH confidence (official docs)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — HIGH confidence (official docs)
- [Railway Private Networking](https://docs.railway.com/networking/private-networking) — HIGH confidence (official docs, confirmed WireGuard-based)
- [SIWE EIP-4361 Spec](https://eips.ethereum.org/EIPS/eip-4361) — HIGH confidence (official EIP)
- [SSE in Next.js — Upstash Guide](https://upstash.com/blog/sse-streaming-llm-responses) — MEDIUM confidence (community, aligned with official patterns)
- [Fixing Slow SSE in Next.js and Vercel (Jan 2026)](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996) — MEDIUM confidence (recent community, consistent with known issues)
- [WireGuard userspace (wireguard-go) for Docker](https://blog.topli.ch/posts/wireguard-docker/) — MEDIUM confidence (community, confirms userspace option)

---
*Architecture research for: AI Agent Subscriptions Platform — v2.0 milestone*
*Researched: 2026-03-22*
