-- Phase 11: Subscriptions & Payments
-- Tracks 100 USDC/month subscription payments on Base.
-- tx_hash is the on-chain proof of payment; expires_at is derived from activated_at + 30 days.
-- One row per payment — renewals INSERT a new row; expiration is the max expires_at per (owner_wallet, agent_id).

CREATE TABLE IF NOT EXISTS subscriptions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_wallet    TEXT NOT NULL,          -- checksummed Ethereum address from SIWE session
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tx_hash         TEXT NOT NULL UNIQUE,   -- Base mainnet transaction hash, proof of payment
  amount_usdc     NUMERIC(10, 2) NOT NULL DEFAULT 100, -- verified on-chain amount
  activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,   -- activated_at + 30 days
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_owner   ON subscriptions(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_subscriptions_agent   ON subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_lookup  ON subscriptions(owner_wallet, agent_id, expires_at DESC);

COMMENT ON TABLE subscriptions IS 'Each row is one 100 USDC payment. Multiple rows per (owner_wallet, agent_id) are valid for renewals.';
COMMENT ON COLUMN subscriptions.tx_hash IS 'Base mainnet tx hash — verified on-chain before insert. UNIQUE prevents double-spend.';
COMMENT ON COLUMN subscriptions.expires_at IS 'Set to activated_at + interval ''30 days'' at insert time.';
