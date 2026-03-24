-- Agent Data Store — database-backed alternative to Filecoin storage
-- Used when AGENT_STORAGE_MODE=database. Stores agent card JSON, agent logs,
-- and NFT metadata directly in Postgres JSONB instead of uploading to Filecoin.
-- Keeps the same upload/download interface so callers are unchanged.

CREATE TABLE IF NOT EXISTS agent_data_store (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,                    -- file name (e.g. agent_card_<id>.json)
  data        JSONB NOT NULL,                   -- the stored JSON payload
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_data_store IS 'Database-backed storage for agent metadata when AGENT_STORAGE_MODE=database. Alternative to Filecoin uploads.';
