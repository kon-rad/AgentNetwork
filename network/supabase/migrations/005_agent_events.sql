-- Phase 14: Observability Dashboard — Agent Events
-- Stores structured observability events emitted by the agent-server supabase-logger.ts.
-- Each row represents one discrete event in an agent's execution lifecycle.
-- agent_id links each event to the running agent; ON DELETE CASCADE cleans up events when
-- an agent is deleted.
-- Supabase Realtime is enabled so the dashboard page can subscribe with
-- filter agent_id=eq.{id} and stream live events without polling.

CREATE TABLE IF NOT EXISTS agent_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,            -- agent that emitted the event
  event_type  TEXT NOT NULL CHECK (event_type IN (
                'turn_start', 'turn_complete', 'tool_call', 'llm_call', 'error'
              )),                                                                 -- lifecycle stage of the event
  payload     JSONB NOT NULL DEFAULT '{}',                                       -- event-specific data (shape varies by event_type)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()                                 -- emission time, used for ordered retrieval
);

CREATE INDEX IF NOT EXISTS idx_agent_events_agent ON agent_events(agent_id, created_at ASC);

ALTER PUBLICATION supabase_realtime ADD TABLE agent_events;

COMMENT ON TABLE agent_events IS 'One row per agent lifecycle event. Consumed by the observability dashboard via Supabase Realtime.';
COMMENT ON COLUMN agent_events.agent_id IS 'Foreign key to agents.id. Realtime subscriptions filter on this column.';
COMMENT ON COLUMN agent_events.event_type IS 'Lifecycle stage: turn_start, turn_complete, tool_call, llm_call, or error. Enforced by CHECK constraint.';
COMMENT ON COLUMN agent_events.payload IS 'Event-specific JSON. llm_call includes model/tokens; tool_call includes tool_name/duration; error includes message.';
COMMENT ON COLUMN agent_events.created_at IS 'Emission timestamp. Used with agent_id for ordered event stream retrieval.';
