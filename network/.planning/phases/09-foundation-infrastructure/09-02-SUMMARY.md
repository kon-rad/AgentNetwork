---
phase: 09-foundation-infrastructure
plan: "02"
subsystem: database
tags: [supabase, postgres, sqlite, migration, api-routes, supabase-js, server-only]

# Dependency graph
requires:
  - phase: 09-01
    provides: Supabase Postgres with all tables populated; @supabase/supabase-js installed
provides:
  - src/lib/supabase/server.ts (cookie-aware server client)
  - src/lib/supabase/admin.ts (service role client, server-only)
  - src/lib/supabase/browser.ts (anon browser client)
  - All API routes reading/writing Supabase Postgres via supabaseAdmin
  - db.ts deleted — better-sqlite3 fully removed from codebase
affects:
  - 09-03 (auth routes use migrated API pattern; auth.ts still in place)
  - All phases — database calls now go through Supabase

# Tech tracking
tech-stack:
  added:
    - "server-only — used in supabase/admin.ts to prevent client bundle inclusion (replaces incorrect 'use server')"
  patterns:
    - "supabaseAdmin.from('table').select('*, related!fk(cols)') — Supabase foreign key join syntax"
    - "Two-query enrichment pattern for tables without FK — fetch IDs then .in() lookup"
    - "requireAgentOwnership() made async — all callers updated to await"
    - "'use server' cannot be used on modules exporting plain objects — use 'server-only' import instead"

key-files:
  created:
    - src/lib/supabase/server.ts
    - src/lib/supabase/admin.ts
    - src/lib/supabase/browser.ts
  modified:
    - src/app/api/agents/route.ts
    - src/app/api/agents/[id]/route.ts
    - src/app/api/agents/[id]/followers/route.ts
    - src/app/api/agents/[id]/feedback/route.ts
    - src/app/api/agents/[id]/filecoin/route.ts
    - src/app/api/agents/[id]/register/route.ts
    - src/app/api/agents/[id]/service/route.ts
    - src/app/api/agents/[id]/services/route.ts
    - src/app/api/posts/route.ts
    - src/app/api/follows/route.ts
    - src/app/api/bounties/route.ts
    - src/app/api/bounties/[id]/claim/route.ts
    - src/app/api/bounties/[id]/complete/route.ts
    - src/app/api/services/[serviceId]/route.ts
    - src/app/api/seed/route.ts
    - src/app/api/chain/upload/route.ts
    - src/app/api/chain/deploy-token/route.ts
    - src/app/api/chain/deploy-collection/route.ts
    - src/app/api/chain/mint-nft/route.ts
    - src/app/api/chain/deploy-all-tokens/route.ts
    - src/app/api/self/verify/route.ts
    - src/app/verify/[agentId]/page.tsx
    - src/lib/auth.ts
    - src/lib/seed.ts
    - src/lib/autonomous/runner.ts
    - src/lib/autonomous/agent-actions.ts
  deleted:
    - src/lib/db.ts

key-decisions:
  - "'use server' directive is for Server Actions only (modules exporting async functions) — supabase/admin.ts uses 'server-only' import instead to prevent client bundle inclusion"
  - "requireAgentOwnership() converted to async function since it now calls Supabase — all call sites updated with await"
  - "Task 2/3 merged in execution: better-sqlite3 absent from package.json meant db.ts blocked TypeScript compilation even with zero importers, requiring all routes to be migrated in sequence before build could pass"
  - "seed() function made async to use supabaseAdmin async calls; seed route updated with await"

requirements-completed: [DB-02, DB-03]

# Metrics
duration: ~20min
completed: 2026-03-22
---

# Phase 9 Plan 02: API Routes Migration to Supabase Summary

**All 25 files migrated from getDb() + better-sqlite3 to supabaseAdmin.from() — db.ts deleted, zero SQLite remaining in src/**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-22
- **Completed:** 2026-03-22
- **Tasks:** 3 auto tasks (Tasks 2/3 merged due to blocking build issue)
- **Files modified:** 26 (3 created, 22 modified, 1 deleted)

## Accomplishments

- Three Supabase client files created: server (cookie-aware), admin (service role, server-only), browser (anon key)
- All 25 TypeScript files importing from `@/lib/db` migrated to `supabaseAdmin.from()` pattern
- `src/lib/db.ts` deleted — `better-sqlite3` completely removed from codebase
- `src/lib/auth.ts` preserved — `verifyAuth()` and `requireAgentOwnership()` migrated to use supabaseAdmin
- `pnpm build` passes with zero TypeScript or module resolution errors
- All response shapes preserved exactly (callers see no difference)

## Task Commits

1. **Task 1: Create Supabase client files** - `0a95099` (feat)
2. **Task 2: Migrate core agent/post routes** - `31829c4` (feat)
3. **Task 3: Migrate auxiliary routes + delete db.ts** - `bd8f56b` (feat)

## Files Created/Modified

**Created:**
- `src/lib/supabase/server.ts` — `createClient()` with cookie forwarding via `@supabase/ssr`
- `src/lib/supabase/admin.ts` — `supabaseAdmin` const with service role key, `server-only` import
- `src/lib/supabase/browser.ts` — `createClient()` via `createBrowserClient` for client components

**Core routes migrated:**
- `api/agents/route.ts` — filter/search/sort with Supabase `.or()`, `.eq()`, `.order()`, `.range()`
- `api/agents/[id]/route.ts` — single lookup `.single()`, dynamic PATCH with `updates` object
- `api/agents/[id]/followers/route.ts` — two-query enrichment pattern (follows + agents IN)
- `api/agents/[id]/feedback/route.ts` — agent lookup before chain calls
- `api/agents/[id]/filecoin/route.ts` — filtered filecoin_uploads query
- `api/agents/[id]/register/route.ts` — ERC-8004 registration with filecoin_uploads inserts
- `api/agents/[id]/service/route.ts` — x402 payment gate with `.maybeSingle()` service lookup
- `api/agents/[id]/services/route.ts` — GET list, POST insert
- `api/posts/route.ts` — foreign key join `agents!posts_agent_id_fkey(...)`, flattened response

**Auxiliary routes migrated:**
- `api/follows/route.ts` — duplicate check + follower_count increment/decrement
- `api/bounties/route.ts` — GET with two-query agent name enrichment, POST insert
- `api/bounties/[id]/claim/route.ts` — status check + claimed_by update
- `api/bounties/[id]/complete/route.ts` — USDC payment flow with status state machine
- `api/services/[serviceId]/route.ts` — JOIN via foreign key select, flattened response
- `api/seed/route.ts` + `lib/seed.ts` — async seed with sequential inserts
- `api/self/verify/route.ts` — `self_verified: true` update via `.ilike()`
- `api/chain/upload, deploy-token, deploy-collection, mint-nft, deploy-all-tokens` — chain routes
- `app/verify/[agentId]/page.tsx` — server component Supabase lookup
- `lib/auth.ts` — `verifyAuth()` + `requireAgentOwnership()` (now async) via supabaseAdmin
- `lib/autonomous/runner.ts` + `agent-actions.ts` — full autonomous loop migration

**Deleted:** `src/lib/db.ts`

## Decisions Made

- `'use server'` directive is for Server Action modules (async function exports only) — using it on a module exporting a plain `const` throws at runtime. Used `import 'server-only'` instead, which prevents client bundle inclusion without the Server Action constraint.
- `requireAgentOwnership()` had to become async to make the Supabase call — all 6 call sites updated to `await`.
- The `seed()` function became async since Supabase client calls are async — the `/api/seed` route handler updated accordingly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 'use server' directive in supabase/admin.ts**
- **Found during:** Task 2 verification (pnpm build)
- **Issue:** `admin.ts` had `'use server'` directive but exported `supabaseAdmin` as a plain const object. Next.js requires all exports in `'use server'` modules to be async functions — runtime error: "A 'use server' file can only export async functions, found object"
- **Fix:** Replaced `'use server'` with `import 'server-only'` — achieves the same security goal (prevents client bundle inclusion) without the Server Action constraint
- **Files modified:** `src/lib/supabase/admin.ts`
- **Commit:** `31829c4`

**2. [Rule 3 - Blocking] Migrated all files in Task 2+3 together due to broken TypeScript build**
- **Found during:** Task 2 verification (pnpm build)
- **Issue:** `better-sqlite3` was removed in 09-01 but `src/lib/db.ts` still existed — TypeScript failed to compile `db.ts` even with zero importers, blocking `pnpm build`. Required migrating ALL remaining `getDb()` callers (not just Task 2's 9 files) before deleting `db.ts` could unblock the build
- **Fix:** Migrated all 25 files in sequence (Tasks 2 and 3 back-to-back), then deleted `db.ts`
- **Files modified:** All files listed above
- **Impact:** No scope creep — all files were planned for migration in this plan; only the sequencing changed

**3. [Rule 2 - Missing Critical] requireAgentOwnership() made async**
- **Found during:** Task 2 implementation
- **Issue:** The original `requireAgentOwnership()` was synchronous (used SQLite `.get()`). Migrating to Supabase required making it async. All 6 call sites needed `await` added
- **Fix:** Made `requireAgentOwnership()` async, added `await` to all 6 callers
- **Files modified:** `src/lib/auth.ts`, plus all route files calling it
- **Commit:** `31829c4`

---

**Total deviations:** 3 auto-fixed (Rule 1 bug, Rule 3 blocking, Rule 2 critical fix)
**Impact on plan:** All fixes necessary for correctness and build success. No scope creep.

## Issues Encountered

- `better-sqlite3` absence caused cascading TypeScript failure that forced Tasks 2+3 to be executed together
- `'use server'` vs `'server-only'` distinction is a common Next.js App Router gotcha

## Next Phase Readiness

- All API routes use Supabase — ready for 09-03 (SIWE auth — replace verifyAuth/requireAgentOwnership with session-based auth)
- `src/lib/auth.ts` preserved and functional — 09-03 will replace it with iron-session
- `src/lib/supabase/admin.ts` is the canonical server-side DB client for all subsequent plans

## Self-Check: PASSED

All files and commits verified:
- FOUND: src/lib/supabase/server.ts
- FOUND: src/lib/supabase/admin.ts
- FOUND: src/lib/supabase/browser.ts
- CONFIRMED: src/lib/db.ts deleted
- FOUND: src/lib/auth.ts (preserved)
- FOUND: 0a95099 (Task 1 commit)
- FOUND: 31829c4 (Task 2 commit)
- FOUND: bd8f56b (Task 3 commit)

---
*Phase: 09-foundation-infrastructure*
*Completed: 2026-03-22*
