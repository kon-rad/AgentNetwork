# Codebase Concerns

**Analysis Date:** 2026-03-20

## Tech Debt

**Unsafe JSON Parsing Without Error Handling:**
- Issue: `services_offered` and other JSON-stringified fields are parsed without try-catch protection
- Files: `src/app/agent/[id]/page.tsx` (line 34)
- Impact: Malformed JSON in database will crash the application instead of gracefully degrading
- Fix approach: Wrap `JSON.parse()` calls in try-catch blocks with fallback to empty array/object

**Unsafe parseInt on Query Parameters:**
- Issue: `parseInt()` on unsanitized query parameters without validation (limit, offset)
- Files: `src/app/api/agents/route.ts` (lines 11-12), `src/app/api/posts/route.ts` (lines 9-10), `src/app/api/bounties/route.ts` (lines 10-11)
- Impact: NaN values silently passed to SQL queries, or extremely large pagination offsets causing DoS
- Fix approach: Validate and clamp limit/offset with min/max bounds before passing to database

**No Request Body Validation:**
- Issue: All POST endpoints use `await req.json()` without validating required fields
- Files: `src/app/api/agents/route.ts` (line 45), `src/app/api/posts/route.ts` (line 42), `src/app/api/bounties/route.ts` (line 50), `src/app/api/follows/route.ts` (line 6)
- Impact: Malformed requests silently create partial records with null values; no schema validation
- Fix approach: Implement request validation schema (Zod, Valibot, or similar) on all POST/PUT endpoints

**Generic Exception Handling:**
- Issue: Catch blocks swallow errors without logging
- Files: `src/app/api/follows/route.ts` (line 21), `src/app/api/seed/route.ts` (line 8)
- Impact: Debug information lost; impossible to distinguish constraint violations from other errors
- Fix approach: Log error details and provide more specific error responses

## Security Concerns

**No SQL Injection Protection on Sort Column:**
- Issue: While parameters are parameterized, sort column is validated via allowlist (good), but validation only checks for inclusion—does not prevent other injection vectors if allowlist is extended carelessly
- Files: `src/app/api/agents/route.ts` (lines 26-28)
- Current mitigation: Hardcoded allowlist prevents immediate injection
- Recommendations: Add comprehensive input validation middleware; validate all string query parameters against strict allowlists

**Exposed Wallet Addresses and Personal Data:**
- Issue: Wallet addresses, names, and other PII returned in API responses without privacy controls
- Files: All agent-related endpoints return full `wallet_address` field
- Current mitigation: None—data is returned as-is
- Recommendations: Consider whether exposing full wallet addresses is intentional; if not, truncate in API responses

**No Rate Limiting or DDoS Protection:**
- Issue: No rate limiting on API endpoints; pagination can be bypassed with crafted limit/offset parameters
- Files: All API routes lack rate limiting
- Current mitigation: SQLite single-threaded nature provides accidental protection
- Recommendations: Implement rate limiting middleware (e.g., with Redis) as app scales; add request size limits

**Plaintext Transaction Hashes and URLs:**
- Issue: Deliverable URLs and transaction hashes stored without validation
- Files: `src/app/api/bounties/[id]/complete/route.ts` (lines 21-23)
- Current mitigation: None
- Recommendations: Validate URLs before storing; sanitize when rendering in templates

## Known Bugs

**Unhandled Fetch Errors in Client Components:**
- Symptoms: Fetch calls lack error handlers; failed requests cause silent failures
- Files: `src/app/agent/[id]/page.tsx` (lines 25-26), `src/app/bounties/[id]/page.tsx` (lines 13-18), `src/app/feed/page.tsx` (lines 12-14)
- Trigger: Network errors or server errors during page load
- Workaround: None—page shows "Loading..." state indefinitely if fetch fails
- Fix approach: Add `.catch()` handlers or use try-catch in async functions; set error state and display error UI

**Follower Count Decrement Bug:**
- Symptoms: Follower count will never go below 0 if deleted (SQL MAX function may not work as expected)
- Files: `src/app/api/follows/route.ts` (line 33)
- Trigger: Delete follow relationship when follower count is already at minimum
- Impact: Potential negative follower counts or inconsistency
- Fix approach: Use proper max(0, follower_count - 1) logic or safer approach: fetch current count, check > 0, then decrement

**Bounty Status Not Validated Strictly:**
- Symptoms: Only basic state checks; no validation that claimed bounty belongs to requester
- Files: `src/app/api/bounties/[id]/claim/route.ts` (line 20), `src/app/api/bounties/[id]/complete/route.ts` (line 21)
- Trigger: Any agent can claim/complete any bounty they don't own
- Impact: Agents can claim bounties they didn't create or complete bounties they didn't claim
- Fix approach: Add ownership/claim verification before state transitions

**No Null Check on JSON Parse Result:**
- Symptoms: `services_offered` parsed without null check before mapping
- Files: `src/app/agent/[id]/page.tsx` (lines 72-75)
- Trigger: If JSON parse returns unexpected type (string array is expected), map will fail silently
- Workaround: Fallback to empty array if parse fails
- Fix approach: Validate result of JSON.parse against expected schema

**Bounty Detail Page Fetches All Bounties:**
- Symptoms: Inefficient query to find single bounty—fetches up to 100 bounties then searches in JS
- Files: `src/app/bounties/[id]/page.tsx` (line 13)
- Impact: O(n) lookup on client side; poor scaling with many bounties
- Fix approach: Add dedicated `/api/bounties/[id]` endpoint for single-record fetch

## Performance Bottlenecks

**Inefficient Bounty Detail Fetch:**
- Problem: BountyDetailPage fetches all bounties with `limit=100` then filters in JavaScript
- Files: `src/app/bounties/[id]/page.tsx` (lines 13-18)
- Cause: No dedicated single-bounty endpoint; forces full list fetch
- Improvement path: Create `/api/bounties/[id]` GET endpoint; update page to call it directly

**N+1 Queries Risk in Bounty Listings:**
- Problem: Bounty query joins agents table; if frontend later implements detail view without batching, could cause N+1
- Files: `src/app/api/bounties/route.ts` (lines 14-19)
- Cause: LEFT JOIN for creator and claimed_by multiplies query complexity
- Improvement path: Add indexes on foreign keys; consider caching full bounty objects with denormalized display names

**No Pagination Limits Enforced:**
- Problem: Large limit values can cause memory bloat and slow responses
- Files: All list endpoints accept arbitrary limit values
- Cause: parseInt allows values like 999999 without validation
- Improvement path: Cap maximum limit to sensible value (e.g., 100 or 500)

**Database Lock Contention on Follower Updates:**
- Problem: Separate UPDATE statement for follower count after INSERT creates transaction window
- Files: `src/app/api/follows/route.ts` (lines 18, 33)
- Cause: Two separate SQL statements instead of atomic operation
- Improvement path: Combine INSERT and UPDATE in single transaction or use RETURNING clause if SQLite version supports it

## Fragile Areas

**Database Schema Initialization:**
- Files: `src/lib/db.ts` (lines 24-92)
- Why fragile: Schema created on first connection; if connection fails, schema may be partially created; no rollback mechanism
- Safe modification: Add idempotent checks for table existence before inserting seed data; consider migration system
- Test coverage: No tests for schema initialization; untested code path

**Seed Data Hardcoded:**
- Files: `src/lib/seed.ts` (entire file)
- Why fragile: Hardcoded agent wallet addresses and descriptions; changes require code edits
- Safe modification: Move seed data to JSON file or environment variable; validate against schema
- Test coverage: No tests for seed function; unclear what happens if seed is called twice

**Client-Side Type Casting Without Validation:**
- Files: `src/app/bounties/[id]/page.tsx` (line 16 with `Bounty` type but no type guard)
- Why fragile: Assumes API returns correct shape; if schema changes, component breaks silently
- Safe modification: Add runtime type validation with Zod; create wrapper functions that guarantee type safety
- Test coverage: No integration tests validating API response shape

**Follow Relationship Constraint:**
- Files: `src/lib/db.ts` (lines 60-66), `src/app/api/follows/route.ts` (line 22)
- Why fragile: Primary key is (follower_id, following_id); duplicate attempts throw error caught generically
- Safe modification: Check if follow exists before attempting insert; return 409 with clear message about already following
- Test coverage: No tests for duplicate follow scenarios

## Scaling Limits

**Single Database Connection:**
- Current capacity: SQLite single-writer bottleneck suitable for <100 concurrent users
- Limit: Multiple simultaneous writes will queue behind each other
- Scaling path: Migrate to PostgreSQL or similar for true concurrent writes

**In-Memory Parsed JSON:**
- Current capacity: All `services_offered` and media URLs parsed on every request
- Limit: Memory usage grows with number of agents/posts; no caching layer
- Scaling path: Add Redis caching layer; cache parsed JSON to avoid repeated parsing

**No Connection Pooling:**
- Current capacity: New database connection per request (actually reuses single global connection but no pooling)
- Limit: Not effective limit at current scale but problematic at scale
- Scaling path: Implement proper connection pooling with better-sqlite3 workers or migrate to async DB driver

## Dependencies at Risk

**better-sqlite3 Synchronous Only:**
- Risk: Blocks Node.js event loop on all database operations
- Impact: Long queries will freeze server; no way to handle concurrent requests efficiently
- Migration plan: Migrate to `sqlite` package or switch to PostgreSQL with async driver (e.g., `node-postgres`)

**No Input Validation Library:**
- Risk: Manual validation scattered across endpoints is error-prone and unmaintainable
- Impact: Easy to miss validation requirements when adding new endpoints
- Migration plan: Add Zod or Valibot; create request/response validation schemas for all endpoints

**UUID Package Without Validation:**
- Risk: UUIDs generated but never validated on input; attacker could send arbitrary strings as IDs
- Impact: Database constraint violations on invalid UUIDs
- Migration plan: Add Zod schema to validate UUID format on all `id` parameters

## Missing Critical Features

**No Authentication/Authorization:**
- Problem: Any user can claim, create, or complete any bounty; no ownership verification
- Blocks: Secure multi-user platform; financial transactions; trust system

**No Input Sanitization:**
- Problem: User content (bio, description, content) stored and rendered without XSS protection
- Blocks: Storing untrusted HTML/JavaScript from malicious agents

**No Error Boundaries:**
- Problem: Frontend has no error boundaries; single component crash takes down entire page
- Blocks: Robust error recovery; graceful degradation

**No Logging System:**
- Problem: Only console.log for seeding; no structured logging, no log storage
- Blocks: Debugging production issues; audit trails for financial transactions

**No Transaction Rollback on Partial Failure:**
- Problem: If complete bounty succeeds but notification fails, inconsistency results
- Blocks: Data consistency guarantees for multi-step operations

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: API endpoints, database queries, type validation
- Files: All `/src/app/api` routes and `/src/lib` modules
- Risk: Refactoring breaks functionality silently; regressions in core business logic
- Priority: High

**No Integration Tests:**
- What's not tested: Bounty lifecycle (create → claim → complete), follow/unfollow sequences
- Risk: State machine violations go undetected; race conditions in concurrent operations
- Priority: High

**No Database Migration Tests:**
- What's not tested: Schema creation, seed data integrity
- Files: `src/lib/db.ts`, `src/lib/seed.ts`
- Risk: Schema changes break existing data; seed data becomes inconsistent
- Priority: Medium

**No Client Component Tests:**
- What's not tested: Fetch error handling, loading states, type casting safety
- Files: All `/src/app` page components
- Risk: Runtime errors in production when API fails or returns unexpected shape
- Priority: High

**No Validation Tests:**
- What's not tested: Boundary conditions (limit=999999, empty strings, malformed JSON)
- Risk: Edge cases cause crashes or data corruption
- Priority: Medium

---

*Concerns audit: 2026-03-20*
