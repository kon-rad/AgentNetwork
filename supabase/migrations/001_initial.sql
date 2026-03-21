-- Phase 9: Initial Supabase Postgres schema
-- Migrated from SQLite (src/lib/db.ts) with the following changes:
--   - TEXT primary keys (matches existing UUIDs/nanoid IDs from SQLite)
--   - agents.self_verified: INTEGER 0/1 -> boolean
--   - agents.owner_wallet: NEW column (nullable — existing agents have no owner)
--   - created_at/updated_at: TEXT -> timestamptz with default now()
--   - All 6 tables included: agents, posts, follows, bounties, filecoin_uploads, services
-- Owner enforcement note: application layer (SIWE session) in v2.0. RLS policy upgrade in future phase.

-- ============================================================
-- agents
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
  id                     TEXT PRIMARY KEY,
  display_name           TEXT NOT NULL,
  avatar_url             TEXT,
  bio                    TEXT,
  service_type           TEXT,
  services_offered       TEXT,
  ens_name               TEXT,
  wallet_address         TEXT NOT NULL,
  erc8004_token_id       TEXT,
  token_address          TEXT,
  token_symbol           TEXT,
  nft_collection_address TEXT,
  self_verified          BOOLEAN DEFAULT FALSE,
  follower_count         INTEGER DEFAULT 0,
  following_count        INTEGER DEFAULT 0,
  owner_wallet           TEXT,            -- nullable: maps to SIWE session address; null = unowned
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agents IS 'Owner enforcement: application layer (SIWE session) in v2.0. RLS policy upgrade in future phase.';
COMMENT ON COLUMN agents.owner_wallet IS 'Ethereum address (checksummed) of the wallet that created/owns this agent. NULL for agents created before v2.0.';

CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(service_type);
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_wallet);

-- ============================================================
-- posts
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content        TEXT NOT NULL,
  media_urls     TEXT,
  media_type     TEXT DEFAULT 'text',
  nft_contract   TEXT,
  nft_token_id   TEXT,
  filecoin_cid   TEXT,
  like_count     INTEGER DEFAULT 0,
  repost_count   INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_agent   ON posts(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

-- ============================================================
-- follows
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
  follower_id   TEXT NOT NULL,
  follower_type TEXT NOT NULL,
  following_id  TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);

-- ============================================================
-- bounties
-- ============================================================
CREATE TABLE IF NOT EXISTS bounties (
  id                    TEXT PRIMARY KEY,
  creator_id            TEXT NOT NULL,
  creator_type          TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  reward_amount         TEXT,
  reward_token          TEXT,
  status                TEXT DEFAULT 'open',
  claimed_by            TEXT REFERENCES agents(id),
  required_service_type TEXT,
  deliverable_url       TEXT,
  tx_hash               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);

-- ============================================================
-- filecoin_uploads
-- ============================================================
CREATE TABLE IF NOT EXISTS filecoin_uploads (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  upload_type    TEXT NOT NULL,
  piece_cid      TEXT NOT NULL,
  retrieval_url  TEXT NOT NULL,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_filecoin_uploads_agent      ON filecoin_uploads(agent_id);
CREATE INDEX IF NOT EXISTS idx_filecoin_uploads_type       ON filecoin_uploads(agent_id, upload_type);

-- ============================================================
-- services
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  price          TEXT,
  price_token    TEXT DEFAULT 'USDC',
  delivery_time  TEXT,
  category       TEXT,
  examples       TEXT,
  requirements   TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_agent ON services(agent_id);
