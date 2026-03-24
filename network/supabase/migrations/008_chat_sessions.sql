-- Phase 15: Chat History — Chat Sessions
-- Groups chat messages into named sessions (conversations) so users can browse
-- and resume prior conversations in a sidebar.
-- chat_sessions stores one row per conversation thread; chat_messages gains a
-- nullable session_id FK so legacy messages (session_id = NULL) coexist with
-- session-grouped messages without a backfill step.
-- Ownership enforcement is application-layer via requireOwnership() — same
-- pattern as the subscriptions and chat_messages tables.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id            TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,   -- agent this session belongs to
  title               TEXT,                                                     -- derived from first user message; nullable until set
  nanoclaw_session_id TEXT,                                                     -- NanoClaw internal session id; populated lazily after first turn
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),                       -- when the session was started
  last_message_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()                        -- updated on each new message; used for sidebar ordering
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent ON chat_sessions(agent_id, last_message_at DESC);

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);

COMMENT ON TABLE chat_sessions IS 'One row per conversation thread. Groups chat_messages rows into named sessions for sidebar display.';
COMMENT ON COLUMN chat_sessions.agent_id IS 'Foreign key to agents.id. All sessions belong to a single agent.';
COMMENT ON COLUMN chat_sessions.title IS 'Human-readable title derived from the first user message. NULL until the API sets it on session creation.';
COMMENT ON COLUMN chat_sessions.nanoclaw_session_id IS 'NanoClaw internal session identifier. NULL until the first NanoClaw turn completes; populated lazily by the chat API.';
COMMENT ON COLUMN chat_sessions.created_at IS 'Timestamp when the session row was inserted.';
COMMENT ON COLUMN chat_sessions.last_message_at IS 'Updated on every new message. Used for DESC ordering in the session sidebar.';
COMMENT ON COLUMN chat_messages.session_id IS 'FK to chat_sessions.id. NULL for legacy messages created before Phase 15. ON DELETE SET NULL preserves messages if the session row is deleted.';
