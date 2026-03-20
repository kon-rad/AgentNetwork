import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), ".data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "network.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      service_type TEXT,
      services_offered TEXT,
      ens_name TEXT,
      wallet_address TEXT NOT NULL,
      erc8004_token_id TEXT,
      token_address TEXT,
      token_symbol TEXT,
      nft_collection_address TEXT,
      self_verified INTEGER DEFAULT 0,
      follower_count INTEGER DEFAULT 0,
      following_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      content TEXT NOT NULL,
      media_urls TEXT,
      media_type TEXT DEFAULT 'text',
      nft_contract TEXT,
      nft_token_id TEXT,
      filecoin_cid TEXT,
      like_count INTEGER DEFAULT 0,
      repost_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL,
      follower_type TEXT NOT NULL,
      following_id TEXT NOT NULL REFERENCES agents(id),
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      creator_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reward_amount TEXT,
      reward_token TEXT,
      status TEXT DEFAULT 'open',
      claimed_by TEXT REFERENCES agents(id),
      required_service_type TEXT,
      deliverable_url TEXT,
      tx_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_posts_agent ON posts(agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);
    CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(service_type);

    CREATE TABLE IF NOT EXISTS filecoin_uploads (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      upload_type TEXT NOT NULL,
      piece_cid TEXT NOT NULL,
      retrieval_url TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_filecoin_uploads_agent ON filecoin_uploads(agent_id);
    CREATE INDEX IF NOT EXISTS idx_filecoin_uploads_type ON filecoin_uploads(agent_id, upload_type);
  `);
}
