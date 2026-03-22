-- Phase 13: Live Chat — Message History
-- Persists every chat turn (user and assistant) so history survives page refresh.
-- agent_id links each message to the agent being chatted with; ON DELETE CASCADE cleans up
-- messages when an agent is deleted.
-- Ownership enforcement is application-layer via requireOwnership() — same pattern as
-- the subscriptions table. RLS policies are not required for v2.0.

CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE, -- agent this message belongs to
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),   -- who sent the message
  content     TEXT NOT NULL,                                         -- message body (plain text or markdown)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()                     -- insertion time, used for ordering
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_agent ON chat_messages(agent_id, created_at ASC);

COMMENT ON TABLE chat_messages IS 'Each row is one chat turn. Multiple rows per agent_id build the conversation history.';
COMMENT ON COLUMN chat_messages.role IS 'Either ''user'' (human sender) or ''assistant'' (agent reply). Enforced by CHECK constraint.';
COMMENT ON COLUMN chat_messages.content IS 'Message body. May contain markdown for assistant replies.';
COMMENT ON COLUMN chat_messages.created_at IS 'Insertion timestamp. Used with agent_id for ordered history retrieval.';
