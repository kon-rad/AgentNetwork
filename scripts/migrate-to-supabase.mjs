#!/usr/bin/env node
/**
 * scripts/migrate-to-supabase.mjs
 *
 * One-time migration: reads all data from .data/network.db (SQLite) and upserts
 * into Supabase Postgres using the service role key (bypasses RLS).
 *
 * Usage:
 *   node scripts/migrate-to-supabase.mjs
 *
 * Prerequisites:
 *   - .env.local must contain real NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - supabase/migrations/001_initial.sql must have been applied to the Supabase project
 *   - sqlite3 CLI must be available (brew install sqlite3 on macOS)
 *
 * To apply the schema first (if not using Supabase CLI):
 *   psql "$DATABASE_URL" < supabase/migrations/001_initial.sql
 * Or paste the contents into Supabase Dashboard → SQL Editor → Run.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Load .env.local manually (node doesn't auto-load it)
// ---------------------------------------------------------------------------
const envPath = resolve(ROOT, '.env.local');
if (!existsSync(envPath)) {
  console.error('ERROR: .env.local not found at', envPath);
  process.exit(1);
}

const envContents = readFileSync(envPath, 'utf8');
for (const line of envContents.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (key && value && !process.env[key]) {
    process.env[key] = value;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || SUPABASE_URL.includes('xxxx')) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL is missing or still a placeholder.');
  console.error('       Set the real value in .env.local before running this script.');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === 'eyJ...') {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or still a placeholder.');
  console.error('       Set the real value in .env.local before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// SQLite path
// ---------------------------------------------------------------------------
const DB_PATH = resolve(ROOT, '.data/network.db');
if (!existsSync(DB_PATH)) {
  console.error('ERROR: SQLite database not found at', DB_PATH);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helper: read a table from SQLite as JSON rows
// ---------------------------------------------------------------------------
function readTable(tableName) {
  const result = execSync(
    `sqlite3 "${DB_PATH}" '.mode json' 'SELECT * FROM ${tableName};'`,
    { encoding: 'utf8' }
  ).trim();
  if (!result) return [];
  return JSON.parse(result);
}

// ---------------------------------------------------------------------------
// Helper: upsert rows into Supabase, returns { inserted, errors }
// ---------------------------------------------------------------------------
async function upsertTable(tableName, rows) {
  if (rows.length === 0) {
    return { inserted: 0, errors: [] };
  }

  const BATCH = 500;
  let inserted = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: false })
      .select('id', { count: 'exact', head: true });

    if (error) {
      errors.push(`batch ${i / BATCH + 1}: ${error.message}`);
    } else {
      inserted += count ?? batch.length;
    }
  }

  return { inserted, errors };
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------
function transformAgents(rows) {
  return rows.map((r) => ({
    ...r,
    // SQLite stores 0/1 integers; Postgres wants boolean
    self_verified: r.self_verified === 1 || r.self_verified === true,
    // Ensure owner_wallet exists (column is new — SQLite doesn't have it)
    owner_wallet: r.owner_wallet ?? null,
  }));
}

function transformBounties(rows) {
  return rows.map((r) => ({
    ...r,
    // completed_at may be NULL — keep as null for Postgres
    completed_at: r.completed_at ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const TABLES = [
  { name: 'agents',           transform: transformAgents },
  { name: 'posts',            transform: null },
  { name: 'follows',          transform: null },
  { name: 'bounties',         transform: transformBounties },
  { name: 'filecoin_uploads', transform: null },
  { name: 'services',         transform: null },
];

console.log('='.repeat(60));
console.log('Supabase Migration — SQLite → Postgres');
console.log(`Source: ${DB_PATH}`);
console.log(`Target: ${SUPABASE_URL}`);
console.log('='.repeat(60));

let totalSqlite = 0;
let totalInserted = 0;
let allErrors = [];

for (const { name, transform } of TABLES) {
  process.stdout.write(`\n[${name}] reading SQLite... `);
  let rows;
  try {
    rows = readTable(name);
  } catch (err) {
    console.error(`\nERROR reading ${name} from SQLite:`, err.message);
    allErrors.push(`${name}: ${err.message}`);
    continue;
  }

  if (transform) rows = transform(rows);

  console.log(`${rows.length} rows found`);
  totalSqlite += rows.length;

  process.stdout.write(`[${name}] upserting into Supabase... `);
  const { inserted, errors } = await upsertTable(name, rows);
  console.log(`${inserted} rows inserted`);
  totalInserted += inserted;

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`  ERROR: ${e}`);
      allErrors.push(`${name} — ${e}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Verify row counts in Supabase
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log('Row count verification:');
console.log('='.repeat(60));

let countMismatch = false;

for (const { name } of TABLES) {
  const { count: sqliteCount } = await Promise.resolve().then(() => {
    try {
      const r = execSync(`sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM ${name};"`, { encoding: 'utf8' }).trim();
      return { count: parseInt(r, 10) };
    } catch {
      return { count: 0 };
    }
  });

  const { count: supabaseCount, error } = await supabase
    .from(name)
    .select('*', { count: 'exact', head: true });

  const match = sqliteCount === supabaseCount;
  const status = match ? 'OK' : 'MISMATCH';
  console.log(`  ${name.padEnd(20)} SQLite: ${String(sqliteCount).padStart(5)}   Supabase: ${String(supabaseCount ?? 'err').padStart(5)}   [${status}]`);

  if (!match) countMismatch = true;
  if (error) console.error(`    Supabase count error: ${error.message}`);
}

console.log('\n' + '='.repeat(60));
if (allErrors.length > 0) {
  console.error('Migration completed WITH ERRORS:');
  allErrors.forEach((e) => console.error(' -', e));
  process.exit(1);
} else if (countMismatch) {
  console.warn('Migration complete but ROW COUNTS DO NOT MATCH. Check data above.');
  process.exit(1);
} else {
  console.log('Migration complete. All row counts match.');
}
