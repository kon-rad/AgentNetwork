---
phase: 09-foundation-infrastructure
plan: "03"
subsystem: auth
tags: [siwe, iron-session, ethereum, wallet-auth, session-cookie, eip-4361]

# Dependency graph
requires:
  - phase: 09-01
    provides: agents table with owner_wallet column (nullable text)
  - phase: 09-02
    provides: supabaseAdmin client + all API routes migrated to Supabase
provides:
  - SIWE nonce/verify/session/signout API routes
  - iron-session encrypted httpOnly cookie sessions (SESSION_SECRET env var)
  - requireAuth() guard returning session or 401
  - requireOwnership(agentId) guard with 401/403/404 enforcement
  - Navbar Sign In / Sign Out UI with SIWE flow
  - owner_wallet added to Agent type in types.ts
affects: [10-agent-server, 11-subscriptions, 13-chat-ui, all phases using agent management routes]

# Tech tracking
tech-stack:
  added: [iron-session v8.0.4, siwe v3.0.0]
  patterns:
    - iron-session encrypted cookie with getIronSession(cookieStore, sessionOptions) in route handlers
    - requireAuth() guard: get session → check authenticated + address → return session | 401 Response
    - requireOwnership() guard: requireAuth() → check owner_wallet → 404|403 if mismatch
    - SIWE nonce flow: GET /nonce → save nonce to session → sign SiweMessage → POST /verify → session.save()

key-files:
  created:
    - src/lib/auth/session.ts
    - src/lib/auth/siwe.ts
    - src/lib/auth/guard.ts
    - src/app/api/auth/siwe/nonce/route.ts
    - src/app/api/auth/siwe/verify/route.ts
    - src/app/api/auth/session/route.ts
    - src/app/api/auth/signout/route.ts
  modified:
    - src/lib/types.ts
    - src/components/layout/navbar.tsx
    - src/app/api/agents/route.ts
    - src/app/api/agents/[id]/route.ts
    - src/app/api/agents/[id]/services/route.ts
    - src/app/api/posts/route.ts
    - src/app/api/bounties/route.ts
    - src/app/api/bounties/[id]/complete/route.ts
    - src/app/api/bounties/[id]/claim/route.ts
    - src/app/api/follows/route.ts

key-decisions:
  - "Deleted src/lib/auth.ts (EIP-191 per-request signing fully replaced by SIWE iron-session)"
  - "All 8 route files using old verifyAuth()/isAuthError() migrated to requireAuth() in Task 1"
  - "Legacy routes (posts, bounties, follows) still check agent.wallet_address for ownership — will migrate to requireOwnership() in Phase 11 when owner_wallet is populated"
  - "requireOwnership() returns 403 (not 401) when agent.owner_wallet is null — legacy agents must claim ownership first"
  - "SESSION_SECRET stored in .env.local only (gitignored) — must be added to Railway env vars at deploy time"
  - "Disk was at 100% capacity (.next cache); cleared .next to free space for build — not a code issue"

patterns-established:
  - "requireAuth() guard pattern: const s = await requireAuth(); if (s instanceof Response) return s"
  - "requireOwnership() guard pattern: const s = await requireOwnership(agentId); if (s instanceof Response) return s"
  - "SIWE sign-in hook: fetch nonce → SiweMessage.prepareMessage() → signMessageAsync → POST verify"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, OWN-01, OWN-02, OWN-03]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 9 Plan 03: SIWE Auth Summary

**SIWE sign-in with iron-session encrypted httpOnly cookies: nonce/verify/signout API, requireAuth() + requireOwnership() guards, navbar Sign In button, all 8 legacy routes migrated from EIP-191**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T19:05:46Z
- **Completed:** 2026-03-21T19:13:45Z
- **Tasks:** 3
- **Files modified:** 17 (10 updated, 7 created, 1 deleted)

## Accomplishments
- Full SIWE auth library: session.ts (iron-session v8), siwe.ts (nonce + verification), guard.ts (requireAuth + requireOwnership)
- Four SIWE API routes: GET /nonce, POST /verify, GET /session, POST /signout
- Navbar Sign In button triggering SIWE flow with wallet connect → sign → session cookie
- All 8 API route files migrated from old EIP-191 per-request auth to session-based requireAuth()
- src/lib/auth.ts deleted — no remaining flat imports
- requireOwnership(agentId) guard with 401/403/404 enforcement for Phase 11 use

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth library and SIWE API routes** - `212d777` (feat)
2. **Task 2: Add Sign In / Sign Out UI to navbar** - `3cac794` (feat)
3. **Task 3: Implement requireOwnership() guard** - `c67a90a` (feat)

## Files Created/Modified
- `src/lib/auth/session.ts` - IronSessionData interface + sessionOptions + getSession() helper
- `src/lib/auth/siwe.ts` - generateNonce() + verifySiweMessage() wrappers
- `src/lib/auth/guard.ts` - requireAuth() + requireOwnership(agentId) guards
- `src/app/api/auth/siwe/nonce/route.ts` - GET: generate nonce, store in session, return { nonce }
- `src/app/api/auth/siwe/verify/route.ts` - POST: verify SIWE signature, create session
- `src/app/api/auth/session/route.ts` - GET: return session address or 401
- `src/app/api/auth/signout/route.ts` - POST: destroy session cookie
- `src/lib/types.ts` - Added owner_wallet?: string | null to Agent interface
- `src/components/layout/navbar.tsx` - Added SIWE sign-in/out UI with state management
- `src/app/api/agents/[id]/route.ts` - Migrated from verifyAuth/isAuthError to requireAuth()
- `src/app/api/agents/[id]/services/route.ts` - Same migration
- `src/app/api/agents/route.ts` - Same migration
- `src/app/api/posts/route.ts` - Same migration
- `src/app/api/bounties/route.ts` - Same migration
- `src/app/api/bounties/[id]/complete/route.ts` - Same migration
- `src/app/api/bounties/[id]/claim/route.ts` - Same migration
- `src/app/api/follows/route.ts` - Same migration
- `src/lib/auth.ts` - DELETED (replaced by src/lib/auth/ directory)

## Decisions Made
- Used wallet_address for ownership checks in legacy routes (posts, bounties, follows) during migration — these will be updated to use requireOwnership() in Phase 11 when owner_wallet is populated for new agents
- requireOwnership() returns 403 when owner_wallet is null rather than falling through to wallet_address comparison — forces explicit ownership claim for new v2.0 agent management
- SESSION_SECRET generated with `openssl rand -base64 32` and stored in .env.local only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated 5 additional route files not listed in plan's files_modified**
- **Found during:** Task 1 (deleting src/lib/auth.ts)
- **Issue:** Plan's files_modified listed only 3 routes but grep found 8 routes still importing from `@/lib/auth`. Deleting auth.ts without migrating all importers would cause runtime crashes.
- **Fix:** Migrated posts/route.ts, bounties/route.ts, bounties/[id]/complete/route.ts, bounties/[id]/claim/route.ts, follows/route.ts — same requireAuth() pattern
- **Files modified:** 5 additional route files
- **Verification:** grep -rn 'from "@/lib/auth"' returns 0 results; TypeScript passes clean
- **Committed in:** 212d777 (Task 1 commit)

**2. [Rule 3 - Blocking] Cleared .next build cache to resolve ENOSPC error**
- **Found during:** Task 2 (pnpm build verification)
- **Issue:** Disk at 100% capacity (82MB free); `pnpm build` failed with ENOSPC write error
- **Fix:** `rm -rf .next` freed 6.2GB; build succeeded on retry
- **Files modified:** None (cache deletion only)
- **Verification:** pnpm build compiled successfully after cache clear
- **Committed in:** N/A (no code change)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for completeness and build success. No scope creep.

## Issues Encountered
- Old dev server (port 3000) was running with stale code that referenced deleted auth.ts — returned 500 for all requests. Killed and restarted fresh server for verification.

## User Setup Required

**SESSION_SECRET must be added to Railway environment variables before deployment.**

The `SESSION_SECRET` value is in `.env.local` (gitignored). To deploy:
1. Railway Dashboard → Project → Variables → Add `SESSION_SECRET`
2. Use the same value as in `.env.local` to preserve existing sessions

Generate a new value if needed: `openssl rand -base64 32`

## Next Phase Readiness
- Phase 10 (Agent Server) can use the same Supabase connection — no auth dependencies
- Phase 11 (Subscriptions) can use requireOwnership() immediately on agent management routes
- Phase 13 (Chat UI) can use requireAuth() to gate chat sessions
- The SIWE sign-in flow is ready for production use

---
*Phase: 09-foundation-infrastructure*
*Completed: 2026-03-22*
