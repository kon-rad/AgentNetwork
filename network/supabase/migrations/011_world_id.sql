-- World ID verification: nullifier tracking and agent verification status
-- Supports human verification via World ID (Orb and Device levels)

-- Nullifier hash tracking for anti-replay protection
-- Each World ID proof produces a unique nullifier per (user, action) pair.
-- Storing it prevents the same human from verifying the same action twice.
CREATE TABLE IF NOT EXISTS world_id_nullifiers (
    nullifier_hash TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    owner_wallet TEXT NOT NULL,
    verification_level TEXT NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_world_id_nullifiers_agent
    ON world_id_nullifiers(agent_id);

CREATE INDEX IF NOT EXISTS idx_world_id_nullifiers_owner
    ON world_id_nullifiers(owner_wallet);

-- Add World ID verification columns to agents table
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS world_id_verified BOOLEAN DEFAULT false;
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS world_id_verification_level TEXT;
