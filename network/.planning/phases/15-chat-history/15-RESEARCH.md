# Phase 15: Chat History - Research

**Researched:** 2026-03-24
**Domain:** Chat session management — Supabase schema extension, Next.js UI sidebar, NanoClaw session mapping
**Confidence:** HIGH

## Summary

Phase 15 adds a session sidebar to the existing chat page at `/agent/[id]/chat`. The current implementation treats every agent as having one flat, undifferentiated message history — all `chat_messages` rows share a single `agent_id` with no session grouping. The goal is to introduce `chat_sessions` as a first-class Supabase concept so users can see a list of past conversations in a left sidebar, click any session to view its messages, and start fresh sessions via a plus button.

The NanoClaw side already has session awareness: the `sessions` table in its SQLite DB stores `group_folder → session_id` (a Claude Code `--resume` session ID), and `container-runner.ts` passes `sessionId` into each `runContainerAgent` call. This means "resuming" a NanoClaw session is already supported at the infrastructure level — Next.js just needs to pass the right session ID when forwarding messages. The key coupling point is the `POST /message` body already accepts a `sessionToken` field (currently unused by Next.js), which can be repurposed to carry the NanoClaw session ID.

The implementation is purely additive: add a `chat_sessions` table to Supabase, add a `session_id` FK column to `chat_messages`, extend the existing API routes, and refactor the chat page to include the sidebar layout. No NanoClaw changes are required for the initial version (NanoClaw already handles session continuity; Next.js just needs to track which session ID to pass).

**Primary recommendation:** Add `chat_sessions` to Supabase, foreign-key `chat_messages.session_id` to it, extend the three existing chat API routes, and split the chat page into a sidebar + message pane layout — all within the existing Next.js + Supabase stack.

---

## Standard Stack

### Core (already in use — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | existing | DB reads/writes via `supabaseAdmin` | Already in use for chat_messages |
| Next.js App Router | existing | API routes + page component | Project standard |
| React hooks | existing | `useState`, `useEffect`, `useRef` | Already drives chat page state |
| Tailwind CSS | existing | Sidebar layout + active session highlighting | Project-wide utility CSS |

### No New Packages Required

The session sidebar is pure data modeling + UI layout. All required primitives (Supabase client, React state, SSE EventSource, Tailwind flex/grid) already exist. No additional npm packages are needed.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
supabase/migrations/
└── 008_chat_sessions.sql          ← new: chat_sessions table + session_id FK on chat_messages

src/
├── app/
│   └── api/
│       └── agents/[id]/
│           ├── sessions/
│           │   ├── route.ts       ← new: GET list sessions, POST create session
│           │   └── [sessionId]/
│           │       └── route.ts   ← new: GET messages for a session, DELETE session
│           └── chat/
│               ├── route.ts       ← modified: session_id required in POST body
│               └── stream/
│                   └── route.ts   ← unchanged (stream is per-agent, not per-session)
└── app/
    └── agent/[id]/
        └── chat/
            └── page.tsx           ← modified: sidebar layout + session state
```

### Pattern 1: chat_sessions Supabase Table

**What:** A new table that gives each conversation a row with metadata (title, created_at, last_message_at). `chat_messages` gets a nullable `session_id` FK that is backfilled to a "legacy" session for all existing messages.

**When to use:** Every time a user starts or resumes a conversation.

**Schema:**
```sql
-- Source: supabase/migrations/008_chat_sessions.sql (to be created)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id     TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title        TEXT,                            -- auto-derived from first user message (first 60 chars)
  nanoclaw_session_id TEXT,                     -- Claude Code resume session ID (returned by NanoClaw)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent
  ON chat_sessions(agent_id, last_message_at DESC);

-- Add session_id to existing chat_messages table
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages(session_id, created_at ASC);
```

**Key decisions:**
- `session_id` is nullable on `chat_messages` so existing messages are not broken during migration; a "legacy" catch-all session can be created at migration time to backfill.
- `nanoclaw_session_id` is the Claude Code `--resume` ID stored by NanoClaw. This enables true conversation continuity (the LLM sees prior context). It is populated lazily on the first response in a session.
- `title` is derived from the first user message (first 60 chars), set on `POST /sessions` or on first `POST /chat`.
- `last_message_at` is updated on each new message insert for correct sidebar ordering.

### Pattern 2: API Route Extensions

**What:** Three route changes to wire session awareness into the existing API surface.

#### GET /api/agents/[id]/sessions
Returns the list of sessions for the sidebar (ordered by `last_message_at DESC`).

```typescript
// Source: src/app/api/agents/[id]/sessions/route.ts (new file)
export async function GET(_req, { params }) {
  const { id: agentId } = await params
  const ownerOrError = await requireOwnership(agentId)
  if (ownerOrError instanceof Response) return ownerOrError

  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, created_at, last_message_at')
    .eq('agent_id', agentId)
    .order('last_message_at', { ascending: false })
    .limit(50)        // cap at 50 sessions for sidebar performance

  return Response.json(data ?? [])
}
```

#### POST /api/agents/[id]/sessions
Creates a new session row and returns it. Called when user clicks the plus button.

```typescript
export async function POST(req, { params }) {
  const { id: agentId } = await params
  const ownerOrError = await requireOwnership(agentId)
  if (ownerOrError instanceof Response) return ownerOrError

  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .insert({ agent_id: agentId })
    .select()
    .single()

  return Response.json(data)
}
```

#### GET /api/agents/[id]/sessions/[sessionId]
Returns messages for a specific session (replaces the current flat history load).

```typescript
// Source: src/app/api/agents/[id]/sessions/[sessionId]/route.ts (new file)
const { data } = await supabaseAdmin
  .from('chat_messages')
  .select('*')
  .eq('agent_id', agentId)
  .eq('session_id', sessionId)
  .order('created_at', { ascending: true })
```

#### Modified POST /api/agents/[id]/chat
Requires `session_id` in the request body. Passes `nanoclaw_session_id` as `sessionToken` to NanoClaw `/message`.

```typescript
// Key change: body now includes { content, session_id }
// Insert message includes session_id:
.insert({ agent_id: agentId, role: 'user', content, session_id })

// NanoClaw forward now includes session token:
body: JSON.stringify({
  agentId,
  message: trimmedContent,
  sender: 'user',
  sessionToken: nanoclawSessionId ?? undefined,  // enables --resume
})

// Also update last_message_at on the session:
await supabaseAdmin
  .from('chat_sessions')
  .update({ last_message_at: new Date().toISOString() })
  .eq('id', session_id)
```

### Pattern 3: Chat Page Sidebar Layout

**What:** The chat page at `/agent/[id]/chat` gains a left sidebar listing sessions. Active session is highlighted. Clicking a session loads its messages. Plus button at top of sidebar creates a new session.

**Layout structure:**
```tsx
// Current: max-w-3xl centered column
// New: full-width flex row with sidebar + main pane

<div className="flex h-[calc(100vh-64px)] overflow-hidden">
  {/* Session sidebar — fixed width, scrollable */}
  <aside className="w-64 shrink-0 border-r border-cyan-500/10 flex flex-col overflow-y-auto">
    {/* Header: "Sessions" label + plus button */}
    {/* Session list: one item per session, active highlighted */}
  </aside>

  {/* Main chat pane — takes remaining width */}
  <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
    {/* Existing chat header, message list, input */}
  </main>
</div>
```

**State model additions to page.tsx:**
```typescript
// New state for session management
const [sessions, setSessions] = useState<ChatSession[]>([])
const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

// On session click: update activeSessionId + load that session's messages
async function loadSession(sessionId: string) {
  setActiveSessionId(sessionId)
  const res = await fetch(`/api/agents/${id}/sessions/${sessionId}`)
  const data = await res.json()
  setMessages(data)
}

// On plus button: POST to /sessions, then loadSession(newSession.id)
async function newSession() {
  const res = await fetch(`/api/agents/${id}/sessions`, { method: 'POST' })
  const session = await res.json()
  setSessions(prev => [session, ...prev])
  loadSession(session.id)
}
```

### Anti-Patterns to Avoid

- **Loading all messages then filtering in client:** Query by `session_id` in SQL, not by loading all chat_messages and filtering by session in JS. The current flat query `WHERE agent_id = X` must become `WHERE agent_id = X AND session_id = Y`.
- **Creating a new session on every page load:** Sessions should be created explicitly by the user (plus button) or on first message if no active session exists. Do not auto-create sessions silently.
- **Breaking the existing flat chat:** Old messages with `session_id = NULL` should still be visible via a legacy session created during migration. The migration creates a single legacy session row and backfills all existing `chat_messages.session_id` values to it.
- **Storing nanoclaw_session_id on the frontend:** This is an internal NanoClaw detail. Store it in Supabase (`chat_sessions.nanoclaw_session_id`), look it up in the API route when forwarding to NanoClaw.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ordered session list | Custom sorted state management | SQL `ORDER BY last_message_at DESC` | Single source of truth, no sync bugs |
| Session title generation | GPT call or regex parsing | Slice first user message content to 60 chars | Sufficient UX, zero latency, no extra API call |
| Session ID generation | `crypto.randomUUID()` in Next.js | `gen_random_uuid()::text` in Supabase DEFAULT | Consistent with existing PK convention in all migrations |
| NanoClaw session resume | New NanoClaw endpoint | Pass `sessionToken` in existing `/message` body | NanoClaw already accepts this field (line 90 of channels/webapp/index.ts) |

**Key insight:** NanoClaw already has session continuity built in. The `sessions` SQLite table (`group_folder → session_id`) and the `--resume` flag handling in `container-runner.ts` mean that if Next.js passes the Claude Code session ID as `sessionToken`, NanoClaw will resume the conversation. The only work is tracking which session ID belongs to which `chat_session` row.

---

## Common Pitfalls

### Pitfall 1: NanoClaw Session ID is Not Known at Session Creation Time
**What goes wrong:** The Claude Code `--resume` session ID is only known *after* the first agent turn completes — it is emitted in `ContainerOutput.newSessionId` and stored by NanoClaw in its SQLite `sessions` table. It is not available when the user clicks the plus button.
**Why it happens:** The ID is created by the Claude API on the first turn, then returned by the container runner.
**How to avoid:** `chat_sessions.nanoclaw_session_id` starts as NULL. On the first `done` SSE event in a new session, the UI should NOT need to do anything — NanoClaw stores its own session ID keyed by `group_folder`. NanoClaw will automatically resume the session on subsequent messages to the same `agentId` because it persists `sessions[group.folder] = output.newSessionId`. The `sessionToken` field in `/message` is only needed if we want to explicitly force a specific resume ID, which is not needed for the basic chat history feature.
**Warning signs:** Users seeing separate NanoClaw session contexts when switching between Supabase chat sessions (the agent won't "remember" the different conversations unless `sessionToken` is threaded through).

### Pitfall 2: Null session_id Breaks History Queries After Migration
**What goes wrong:** After adding `session_id` column, the current GET history query `WHERE agent_id = X ORDER BY created_at` still works for displaying all messages, but the new per-session query `WHERE session_id = Y` returns empty for old messages.
**Why it happens:** Existing rows have `session_id = NULL`.
**How to avoid:** The migration creates a "legacy" session row first, then backfills: `UPDATE chat_messages SET session_id = '<legacy-id>' WHERE agent_id = <agentId> AND session_id IS NULL`. Do this in the SQL migration file before making `session_id` NOT NULL.
**Warning signs:** Chat page showing empty message list on first load after migration for agents with existing history.

### Pitfall 3: Session Created But No Messages — Phantom Sessions
**What goes wrong:** User clicks plus, a session row is created, then navigates away without sending a message. The sidebar accumulates empty sessions.
**Why it happens:** Eager session creation pattern.
**How to avoid:** Two acceptable strategies — (A) create the session lazily on first message send, not on plus-button click (UI shows "new chat" as a pending state); or (B) delete sessions with no messages on GET /sessions. Strategy A is simpler. Strategy B requires a LEFT JOIN or subquery.
**Warning signs:** Growing list of empty session entries in the sidebar.

### Pitfall 4: SSE Stream is Per-Agent, Not Per-Session
**What goes wrong:** The stream route `/api/agents/[id]/chat/stream` connects to NanoClaw's `/stream/:agentId`. If a user has two browser tabs open on different sessions, both SSE connections would receive the same agent's responses.
**Why it happens:** NanoClaw's `sseClients` map is keyed by `jid` (`agentId@webapp`), not by session.
**How to avoid:** For v2.0, this is acceptable — one agent, one active stream. Document it. Do not attempt to add session-keyed SSE in this phase.
**Warning signs:** Not a bug for single-user single-tab usage, which is the expected pattern.

### Pitfall 5: Sidebar Re-renders During Streaming Stale Session Order
**What goes wrong:** The `last_message_at` update in the API route correctly reorders sessions in the DB, but the sidebar React state won't re-sort automatically — the session that just received a message will stay at its old position in the list until the page reloads or sessions list is refetched.
**How to avoid:** After each successful message send, update the active session's `last_message_at` in local React state by moving it to the top of the `sessions` array. No Supabase Realtime subscription needed.

---

## Code Examples

### Migration: chat_sessions + session_id backfill

```sql
-- Source: supabase/migrations/008_chat_sessions.sql

CREATE TABLE IF NOT EXISTS chat_sessions (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id            TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title               TEXT,
  nanoclaw_session_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent
  ON chat_sessions(agent_id, last_message_at DESC);

-- Add session_id column to chat_messages (nullable to preserve existing rows)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages(session_id, created_at ASC);

COMMENT ON TABLE chat_sessions IS 'One row per conversation session. Messages are grouped by session_id.';
COMMENT ON COLUMN chat_sessions.nanoclaw_session_id IS 'Claude Code --resume session ID managed by NanoClaw. NULL until first turn completes.';
COMMENT ON COLUMN chat_sessions.title IS 'Derived from first user message (first 60 chars). NULL until first message sent.';
COMMENT ON COLUMN chat_sessions.last_message_at IS 'Updated on each new message. Controls sidebar sort order.';
```

### Backfill Existing Messages (per-agent, run for each agent)

The migration cannot know all `agent_id` values at write time. The best approach is to handle this at application startup or via a small script, OR to handle it lazily: when the chat page loads and finds messages with `session_id IS NULL`, create one legacy session and backfill in the API route.

The simpler approach used in prior migrations is to create a single migration that handles the structural change, and let the application-layer handle legacy data gracefully (return all messages with NULL session_id in a "legacy" bucket in the GET /sessions response).

### ChatSession TypeScript Type

```typescript
// Source: src/lib/types.ts (append after ChatMessage)
export interface ChatSession {
  id: string;
  agent_id: string;
  title: string | null;
  nanoclaw_session_id: string | null;
  created_at: string;
  last_message_at: string;
}
```

### Session Sidebar Item Component Pattern

```tsx
// Inline in page.tsx (per project convention — no new component files unless warranted)
function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: ChatSession;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 font-mono text-xs truncate transition-colors
        ${isActive
          ? "bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}
    >
      {session.title ?? "New conversation"}
    </button>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single flat chat history per agent | Session-grouped history with sidebar navigation | Users can isolate conversations by topic or date |
| No session concept in Supabase | `chat_sessions` table with `last_message_at` ordering | Sidebar is a simple DB query, no custom sort logic needed |
| `chat_messages.session_id = NULL` for all rows | Nullable FK with legacy backfill | Backward-compatible migration; no data loss |

**Deprecated/outdated:**
- The current GET `/api/agents/[id]/chat` flat history query becomes the legacy fallback. New UI uses per-session queries via `/api/agents/[id]/sessions/[sessionId]`.

---

## Open Questions

1. **Session title auto-population**
   - What we know: First 60 chars of first user message is sufficient for MVP.
   - What's unclear: Should the title be set on `POST /chat` (when first message is sent) or on `POST /sessions` (when session is created, before any message)?
   - Recommendation: Set on first message. The `POST /chat` handler can update `chat_sessions.title` if the session has no title yet.

2. **What happens to existing messages when migration runs?**
   - What we know: `session_id` column will be nullable; existing rows have `session_id = NULL`.
   - What's unclear: Whether to auto-create one legacy session per agent and backfill, or show them as orphaned.
   - Recommendation: Create one legacy session per agent in a post-migration script OR handle lazily: GET /sessions returns a synthetic legacy entry if orphaned messages exist. Simplest: the Next.js API route for GET sessions can detect orphaned messages and create a legacy session on the fly.

3. **NanoClaw session continuity across UI sessions**
   - What we know: NanoClaw stores `sessions[group_folder] = session_id` in SQLite. It automatically resumes the same Claude session for a given `group_folder`. This means the *NanoClaw session* is continuous across all Supabase `chat_session` rows for the same agent.
   - What's unclear: Do we want switching to an older Supabase chat_session to actually resume that older LLM context, or just load the old messages visually while continuing the current NanoClaw session?
   - Recommendation: For Phase 15, do visual-only — load old messages for display, but new messages always go to the current NanoClaw session (no `sessionToken` threading). True multi-session LLM context is out of scope.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `/agent-server/src/channels/webapp/index.ts` — `/message` endpoint accepts `sessionToken` field (line 90)
- Direct code reading: `/agent-server/src/index.ts` — `sessions[group.folder]` maps to NanoClaw session ID, automatically resumed
- Direct code reading: `/agent-server/src/db.ts` — `sessions` SQLite table with `group_folder → session_id`
- Direct code reading: `supabase/migrations/004_chat_messages.sql` — current schema with no `session_id`
- Direct code reading: `src/app/agent/[id]/chat/page.tsx` — current flat history + SSE architecture
- Direct code reading: `src/app/api/agents/[id]/chat/route.ts` — existing GET/POST handlers
- Direct code reading: `src/app/api/agents/[id]/chat/stream/route.ts` — SSE proxy (no changes needed)
- Direct code reading: `src/lib/types.ts` — `ChatMessage` type (to be extended with `ChatSession`)

### Secondary (MEDIUM confidence)
- Pattern from `supabase/migrations/005_agent_events.sql` — established convention for nullable JSONB, table comments, index naming
- Pattern from `supabase/migrations/002_subscriptions.sql` — established convention for Supabase migration structure in this project

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — same packages as Phase 13, no new dependencies
- Architecture: HIGH — NanoClaw session mechanics verified from source; Supabase schema pattern verified from existing migrations
- Pitfalls: HIGH — derived from reading actual implementation, not speculation
- NanoClaw session threading: MEDIUM — `sessionToken` field exists but is not currently used by Next.js; behavior when passed was inferred from NanoClaw source code, not tested end-to-end

**Research date:** 2026-03-24
**Valid until:** 60 days (stable architecture, no fast-moving dependencies)
