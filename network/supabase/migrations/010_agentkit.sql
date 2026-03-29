-- AgentKit integration: usage tracking and nonce replay protection
-- Supports Worldcoin AgentKit free-trial mode for external agent verification

-- Usage tracking for AgentKit free-trial mode
-- Tracks how many free requests each verified human has used per endpoint
CREATE TABLE IF NOT EXISTS agentkit_usage (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    endpoint TEXT NOT NULL,
    human_id TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(endpoint, human_id)
);

-- Nonce replay protection
-- Prevents the same AgentKit proof from being used twice
CREATE TABLE IF NOT EXISTS agentkit_nonces (
    nonce TEXT PRIMARY KEY,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup index for usage checks
CREATE INDEX IF NOT EXISTS idx_agentkit_usage_lookup ON agentkit_usage(endpoint, human_id);

-- Track AgentBook registration status on agent wallets
ALTER TABLE agent_wallet_keys
    ADD COLUMN IF NOT EXISTS agentbook_registered BOOLEAN DEFAULT false;

-- Atomic usage increment function.
-- Inserts a new row with count=1 if none exists, or increments count if under limit.
-- Returns true if usage was incremented (access granted), false if limit reached.
-- Uses row-level locking to prevent TOCTOU race conditions.
CREATE OR REPLACE FUNCTION agentkit_try_increment_usage(
    p_endpoint TEXT,
    p_human_id TEXT,
    p_limit INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Try to insert first (handles the "no row yet" case)
    INSERT INTO agentkit_usage (endpoint, human_id, count, updated_at)
    VALUES (p_endpoint, p_human_id, 1, now())
    ON CONFLICT (endpoint, human_id) DO NOTHING;

    IF FOUND THEN
        -- Fresh insert succeeded, count is now 1
        RETURN TRUE;
    END IF;

    -- Row exists — lock it and check the count
    SELECT count INTO v_count
    FROM agentkit_usage
    WHERE endpoint = p_endpoint AND human_id = p_human_id
    FOR UPDATE;

    IF v_count < p_limit THEN
        UPDATE agentkit_usage
        SET count = count + 1, updated_at = now()
        WHERE endpoint = p_endpoint AND human_id = p_human_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
