---
phase: 09-foundation-infrastructure
plan: "01"
subsystem: database
tags: [supabase, postgres, sqlite, migration, supabase-js, iron-session, siwe]

# Dependency graph
requires:
  - phase: 08-autonomous-loop
    provides: SQLite schema with all 6 tables (agents, posts, follows, bounties, filecoin_uploads, services)
provides:
  - Supabase Postgres project with all 6 tables populated from SQLite
  - supabase-js client configured with service role key
  - agents.owner_wallet column (nullable) for SIWE ownership
  - One-time migration script for SQLite → Postgres
  - Postgres schema in supabase/migrations/001_initial.sql
affects:
  - 09-02 (api-routes migration to Supabase client)
  - 10-nanoclaw-vps (VPS reads same Supabase Postgres)
  - All phases using database

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js ^2.x — Supabase JS client"
    - "@supabase/ssr — SSR helpers for Next.js"
    - "siwe — Sign-In with Ethereum message parsing"
    - "iron-session — stateless encrypted cookie sessions"
  patterns:
    - "createClient(url, serviceRoleKey) for server-side admin operations bypassing RLS"
    - "Composite PK tables need explicit onConflict column in upsert (not always 'id')"
    - "SQLite INTEGER 0/1 → Postgres BOOLEAN requires transform in migration"

key-files:
  created:
    - supabase/migrations/001_initial.sql
    - scripts/migrate-to-supabase.mjs
  modified:
    - package.json (added @supabase/supabase-js, @supabase/ssr, siwe, iron-session; removed better-sqlite3)
    - .env.local (added NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL)

key-decisions:
  - "Composite-PK tables (follows) need onConflict: 'follower_id,following_id' not 'id' in supabase-js upsert"
  - "better-sqlite3 removed from package.json — SQLite file preserved on disk for reference"
  - "owner_wallet added as nullable text column to agents table — existing agents get null, new agents in v2.0 get SIWE address"
  - "Schema applied manually via Supabase Dashboard SQL editor (Supabase CLI not used)"

patterns-established:
  - "Migration pattern: sqlite3 CLI .mode json → JSON parse → transform → supabase.from().upsert()"
  - "COMPOSITE_PK map pattern for upsert tables without single id column"

requirements-completed: [DB-01, DB-03]

# Metrics
duration: ~30min (including human checkpoint for schema apply)
completed: 2026-03-22
---

# Phase 9 Plan 01: Supabase Database Migration Summary

**Supabase Postgres replacing SQLite — all 6 tables created, 45 rows migrated with zero data loss, @supabase/supabase-js + iron-session + siwe installed**

## Performance

- **Duration:** ~30 min (including human checkpoint to apply schema in Supabase Dashboard)
- **Started:** 2026-03-22
- **Completed:** 2026-03-22
- **Tasks:** 2 auto tasks + 2 human checkpoints
- **Files modified:** 4 (package.json, .env.local, 001_initial.sql, migrate-to-supabase.mjs)

## Accomplishments

- Supabase Postgres project live with all 6 tables from the SQLite schema plus new `agents.owner_wallet` column
- Full data migration: 8 agents, 13 posts, 13 follows, 5 bounties, 0 filecoin_uploads, 6 services — all verified OK
- New packages installed: `@supabase/supabase-js`, `@supabase/ssr`, `siwe`, `iron-session`; `better-sqlite3` removed
- Migration script handles composite primary key tables, boolean transforms, and batch upserts with error reporting

## Task Commits

1. **Task 2: Install packages, create Postgres schema, migration script** - `48063b7` (feat)
2. **Task 2 deviation fix: composite PK conflict column** - `e1d2171` (fix)

## Files Created/Modified

- `supabase/migrations/001_initial.sql` — Full Postgres schema (6 tables, indexes, owner_wallet column, table comments)
- `scripts/migrate-to-supabase.mjs` — One-time SQLite → Supabase migration with row count verification
- `package.json` — Added supabase-js, @supabase/ssr, siwe, iron-session; removed better-sqlite3
- `.env.local` — Added NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL

## Decisions Made

- Schema applied via Supabase Dashboard SQL editor (user pasted 001_initial.sql manually) — Supabase CLI not required
- `owner_wallet` column is nullable text — existing agents from SQLite have null, new v2.0 agents will have their SIWE wallet address
- `better-sqlite3` removed from package.json but `.data/network.db` file kept on disk for reference until Phase 9 is complete

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed composite primary key conflict column in follows upsert**
- **Found during:** Task 2 (migration script run)
- **Issue:** `follows` table has composite PK `(follower_id, following_id)` but migration script used `onConflict: 'id'` globally — supabase-js returned "column id does not exist" error, 0 rows inserted
- **Fix:** Added `COMPOSITE_PK` map to `migrate-to-supabase.mjs` that maps table name to correct conflict column string; follows uses `'follower_id,following_id'`
- **Files modified:** `scripts/migrate-to-supabase.mjs`
- **Verification:** Re-ran migration — follows: SQLite 13, Supabase 13 [OK]
- **Committed in:** `e1d2171` (fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Fix necessary for correct migration of follows data. No scope creep.

## Issues Encountered

- Supabase CLI (`npx supabase db push`) not used — user applied schema via Dashboard SQL editor instead (simpler, no CLI auth required)

## User Setup Required

User manually applied `supabase/migrations/001_initial.sql` via Supabase Dashboard SQL Editor.
All four Supabase env vars are now set in `.env.local`.

## Next Phase Readiness

- Supabase Postgres is live with all data — ready for Phase 09-02: API routes migration from `src/lib/db.ts` to `@supabase/supabase-js`
- `src/lib/db.ts` (better-sqlite3) still in place — will be deleted in 09-02 after all routes migrate
- `owner_wallet` column available for SIWE auth work in later Phase 9 plans

## Self-Check: PASSED

All files and commits verified:
- FOUND: supabase/migrations/001_initial.sql
- FOUND: scripts/migrate-to-supabase.mjs
- FOUND: .planning/phases/09-foundation-infrastructure/09-01-SUMMARY.md
- FOUND: 48063b7 (feat commit)
- FOUND: e1d2171 (fix commit)

---
*Phase: 09-foundation-infrastructure*
*Completed: 2026-03-22*
