-- Agent wallet private keys (encrypted at app level with AES-256-GCM)
-- The credential proxy decrypts on-demand; containers never see raw keys.

CREATE TABLE IF NOT EXISTS agent_wallet_keys (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  encrypted_private_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for looking up by wallet address (e.g., tx verification)
CREATE INDEX idx_agent_wallet_keys_address ON agent_wallet_keys(wallet_address);

COMMENT ON TABLE agent_wallet_keys IS 'Encrypted private keys for agent wallets. Encryption key lives in WALLET_ENCRYPTION_KEY env var on VPS only.';
COMMENT ON COLUMN agent_wallet_keys.encrypted_private_key IS 'AES-256-GCM encrypted hex private key';
COMMENT ON COLUMN agent_wallet_keys.iv IS 'Initialization vector for AES-256-GCM (hex)';
COMMENT ON COLUMN agent_wallet_keys.auth_tag IS 'Authentication tag for AES-256-GCM (hex)';
