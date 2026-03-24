-- Agent trade history and token holdings for profile observability

CREATE TABLE IF NOT EXISTS agent_trades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tx_hash TEXT,
  token_in_address TEXT NOT NULL,
  token_out_address TEXT NOT NULL,
  token_in_symbol TEXT,
  token_out_symbol TEXT,
  amount_in TEXT NOT NULL,
  amount_out TEXT NOT NULL,
  amount_in_formatted TEXT,
  amount_out_formatted TEXT,
  price_impact TEXT,
  gas_fee TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, confirmed, failed
  chain_id INTEGER NOT NULL DEFAULT 8453,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_trades_agent ON agent_trades(agent_id, created_at DESC);
CREATE INDEX idx_agent_trades_tx ON agent_trades(tx_hash);

-- Token holdings: updated after each trade
CREATE TABLE IF NOT EXISTS agent_token_holdings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  token_address TEXT NOT NULL,
  token_symbol TEXT,
  token_name TEXT,
  decimals INTEGER NOT NULL DEFAULT 18,
  balance TEXT NOT NULL DEFAULT '0',
  balance_formatted TEXT,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, token_address)
);

CREATE INDEX idx_agent_holdings_agent ON agent_token_holdings(agent_id);

GRANT ALL ON public.agent_trades TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.agent_token_holdings TO postgres, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
