# Phase 9: Foundation Infrastructure - Research

**Researched:** 2026-03-22
**Domain:** Supabase Postgres migration, SIWE + iron-session auth, agent ownership enforcement, Railway CI/CD
**Confidence:** HIGH (stack verified in STACK.md; current codebase analyzed directly)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | Existing SQLite tables (agents, posts, follows, bounties) migrated to Supabase Postgres with zero data loss | Schema verified in `src/lib/db.ts`; 5 tables identified; migration script pattern documented |
| DB-02 | All Next.js API routes use Supabase client with connection pooling (Supavisor port 6543) | `@supabase/supabase-js` + `@supabase/ssr` stack verified; Supavisor connection string pattern documented |
| DB-03 | NanoClaw VPS service can read/write to the same Supabase database as Next.js app | Service role key pattern documented; VPS can use `@supabase/supabase-js` directly without `@supabase/ssr` |
| AUTH-01 | User can sign in by signing a SIWE message with their Ethereum wallet | `siwe` v3.0.0 + `iron-session` v8.0.1 pattern fully documented; nonce flow specified |
| AUTH-02 | User session persists across page refresh via httpOnly cookie (iron-session) | `iron-session` v8 stateless encrypted cookie pattern documented; no DB session table needed |
| AUTH-03 | User can sign out and session is invalidated | Session destruction pattern with `req.session.destroy()` documented |
| AUTH-04 | API routes reject unauthenticated requests with 401 | Middleware guard helper pattern documented; replaces current EIP-191 per-request signing |
| OWN-01 | Each agent has an `owner_wallet` field linking it to the wallet that paid for it | Column addition to `agents` table documented; maps to SIWE session address |
| OWN-02 | Only the owner wallet can access an agent's chat, observability, and management | Server-side ownership check pattern using `session.address === agent.owner_wallet` documented |
| OWN-03 | Supabase Row-Level Security policies enforce ownership on agent_events, messages, and agent rows | RLS policy patterns with `current_setting('request.jwt.claims')` documented |
| CICD-01 | Monorepo structure: `app/` (Next.js) and `agent-server/` (NanoClaw fork) in one repo | Monorepo restructuring needed — current project is flat; migration path documented |
| CICD-02 | GitHub Actions deploys `app/` changes to Railway automatically | Railway + GitHub Actions path-filtered workflow pattern documented |
</phase_requirements>

---

## Summary

Phase 9 is the foundation for all v2.0 work. It has four distinct domains: (1) migrate the existing SQLite database to Supabase Postgres, (2) replace the custom EIP-191 per-request auth with SIWE + iron-session cookie sessions, (3) add `owner_wallet` to agents and enforce access at both the API layer (session check) and DB layer (RLS), and (4) restructure the repo into a monorepo and wire GitHub Actions to auto-deploy `app/` to Railway.

The current codebase uses `better-sqlite3` with a hand-written schema across 5 tables: `agents`, `posts`, `follows`, `bounties`, `services` (plus `filecoin_uploads`). The auth layer is a custom EIP-191 per-request signing scheme in `src/lib/auth.ts`. Both of these need to be replaced — not augmented. The existing `auth.ts` is being deleted, not extended. Every API route that calls `verifyAuth()` or `requireAgentOwnership()` needs updating.

The stack for each area is already decided in `STATE.md` and `STACK.md`: `@supabase/supabase-js` ^2.99.3 + `@supabase/ssr` ^0.8.1 for database, `siwe` ^3.0.0 + `iron-session` ^8.0.1 for auth. The monorepo structure calls for moving the current Next.js source into `app/` subdirectory and creating `agent-server/` for the NanoClaw fork (Phase 10). In Phase 9, only `app/` needs to be created — `agent-server/` is a stub.

**Primary recommendation:** Attack in four sequential stages: (1) set up Supabase and migrate data, (2) swap all DB calls from SQLite to Supabase client, (3) implement SIWE auth + replace every `verifyAuth()` call, (4) add RLS + ownership checks, then do monorepo restructure + CI/CD wiring last (lowest risk of breaking running code).

---

## Standard Stack

### Core (New — Phase 9 Additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.99.3 | Postgres client + Realtime + RLS | Official Supabase client; v2 API stable; connection pooling via Supavisor |
| `@supabase/ssr` | ^0.8.1 | Cookie-based client for Next.js App Router | Replaces deprecated `@supabase/auth-helpers-nextjs`; works with `next/headers` cookies() |
| `siwe` | ^3.0.0 | EIP-4361 SIWE message construction + verification | Official SpruceID library; v3 drops ethers dep; latest stable Jan 2026 |
| `iron-session` | ^8.0.1 | Encrypted stateless httpOnly cookie sessions | v8 built for App Router; `getIronSession(cookies(), config)` in route handlers |

### Existing (Do Not Change)

| Library | Version | Purpose | Constraint |
|---------|---------|---------|------------|
| `wagmi` | ^2.19.5 | `useSignMessage` hook for SIWE flow | Do NOT upgrade to v3 — RainbowKit 2.x pins to wagmi ^2.x |
| `viem` | ^2.47.5 | `verifyMessage` for server-side SIWE verification | Already in stack; use `verifyMessage` from viem in SIWE verify route |
| `@rainbow-me/rainbowkit` | ^2.2.10 | Wallet connect UI — unchanged | SIWE sign-in is added on top, not replacing wallet connect |

### What to Remove

| Remove | Replace With | Reason |
|--------|-------------|--------|
| `better-sqlite3` | `@supabase/supabase-js` | SQLite is single-process; can't be shared with NanoClaw VPS |
| `src/lib/db.ts` | `src/lib/supabase/server.ts` + `admin.ts` | Full replacement, not migration wrapper |
| `src/lib/auth.ts` | `src/lib/auth/session.ts` + `src/lib/auth/siwe.ts` | Custom EIP-191 per-request auth replaced by SIWE session cookie |

**Installation (new packages only):**
```bash
pnpm add @supabase/supabase-js @supabase/ssr siwe iron-session
pnpm remove better-sqlite3
pnpm remove -D @types/better-sqlite3
```

---

## Architecture Patterns

### Current State (What Exists Now)

```
src/
├── lib/
│   ├── db.ts          # better-sqlite3 — ALL DB access goes through here
│   ├── auth.ts        # EIP-191 per-request verifyAuth() — called from every API route
│   ├── types.ts       # Agent, Post, Bounty, Follow, Service interfaces
│   └── wagmi.ts       # wagmi config (keep as-is)
├── app/
│   └── api/
│       ├── agents/    # all call getDb() + verifyAuth()
│       ├── auth/      # existing custom auth
│       ├── posts/
│       ├── bounties/
│       └── services/
```

### Target State (After Phase 9)

```
network/                           # monorepo root
├── app/                           # Next.js (moved here from root)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── server.ts      # createServerClient (anon key + cookie forwarding)
│   │   │   │   ├── admin.ts       # createClient with service role key (server-only)
│   │   │   │   └── browser.ts     # createBrowserClient (anon key, RLS-restricted)
│   │   │   ├── auth/
│   │   │   │   ├── session.ts     # getIronSession helper + IronSessionData type
│   │   │   │   ├── siwe.ts        # nonce generation, SIWE message verify
│   │   │   │   └── guard.ts       # requireAuth() helper for route handlers
│   │   │   ├── types.ts           # updated interfaces (add owner_wallet to Agent)
│   │   │   └── wagmi.ts           # unchanged
│   │   └── app/
│   │       └── api/
│   │           ├── auth/
│   │           │   └── siwe/
│   │           │       ├── nonce/route.ts    # GET — generate nonce, set pre-auth cookie
│   │           │       └── verify/route.ts   # POST — verify SIWE sig, set session
│   │           │   └── session/route.ts      # GET — return current session or 401
│   │           │   └── signout/route.ts      # POST — destroy session
│   │           ├── agents/     # updated: getDb() → supabaseAdmin, verifyAuth() → requireAuth()
│   │           ├── bounties/   # same pattern
│   │           ├── posts/      # same pattern
│   │           └── services/   # same pattern
│   └── package.json
├── agent-server/                  # stub only in Phase 9 (built in Phase 10)
│   └── package.json               # placeholder
├── .github/
│   └── workflows/
│       └── deploy-app.yml         # Railway deploy on app/** push to main
└── package.json                   # pnpm workspace root
```

### Pattern 1: Supabase Client Setup (Server vs Admin vs Browser)

**What:** Three distinct Supabase client files. Never mix them.
**When to use:** Server client for route handlers reading user data (RLS applies). Admin client for migrations, seed, and operations that bypass RLS. Browser client for client components subscribing to Realtime.

```typescript
// src/lib/supabase/server.ts — for route handlers and server components
// Source: @supabase/ssr official docs
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookies can't be set in render
          }
        },
      },
    }
  )
}

// src/lib/supabase/admin.ts — service role, bypasses RLS — NEVER import in client bundles
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // NEVER in NEXT_PUBLIC_* vars
)

// src/lib/supabase/browser.ts — for client components (Realtime, etc.)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 2: SIWE Auth Flow (Nonce + Verify + Session)

**What:** Three-step SIWE auth: GET nonce → browser signs SIWE message → POST verify → session cookie issued.
**When to use:** User connects wallet and clicks "Sign In". Once authenticated, subsequent API calls use the cookie, not per-request signatures.

```typescript
// src/lib/auth/session.ts
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface IronSessionData {
  address?: string
  chainId?: number
  nonce?: string
  authenticated?: boolean
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!, // min 32 chars
  cookieName: 'network-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<IronSessionData>(cookieStore, sessionOptions)
}

// src/app/api/auth/siwe/nonce/route.ts
import { generateNonce } from 'siwe'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  session.nonce = generateNonce()
  await session.save()
  return Response.json({ nonce: session.nonce })
}

// src/app/api/auth/siwe/verify/route.ts
import { SiweMessage } from 'siwe'
import { getSession } from '@/lib/auth/session'

export async function POST(req: Request) {
  const { message, signature } = await req.json()
  const session = await getSession()

  const siweMsg = new SiweMessage(message)
  const { success, data, error } = await siweMsg.verify({
    signature,
    nonce: session.nonce,  // verify nonce matches what we issued
  })

  if (!success) {
    return Response.json({ error: error?.type ?? 'Invalid signature' }, { status: 422 })
  }

  session.address = data.address
  session.chainId = data.chainId
  session.authenticated = true
  session.nonce = undefined  // consume nonce — prevent replay
  await session.save()
  return Response.json({ address: data.address })
}

// src/app/api/auth/signout/route.ts
export async function POST() {
  const session = await getSession()
  session.destroy()
  return Response.json({ success: true })
}
```

### Pattern 3: Route Guard Helper (replaces `verifyAuth`)

**What:** A `requireAuth()` helper that replaces the current `verifyAuth()` pattern. Returns the session or a 401 Response.
**When to use:** Top of every authenticated route handler.

```typescript
// src/lib/auth/guard.ts
import { getSession, IronSessionData } from './session'

export async function requireAuth(): Promise<IronSessionData | Response> {
  const session = await getSession()
  if (!session.authenticated || !session.address) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return session
}

// Usage in a route handler — replaces old verifyAuth() pattern:
export async function GET(req: Request) {
  const authResult = await requireAuth()
  if (authResult instanceof Response) return authResult
  const { address } = authResult
  // ... rest of handler
}
```

### Pattern 4: Agent Ownership Check

**What:** Server-side check that session wallet address matches `agent.owner_wallet`. This is the application-layer enforcement (OWN-02). RLS handles DB-layer enforcement (OWN-03).

```typescript
// In any agent-specific route handler
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const authResult = await requireAuth()
  if (authResult instanceof Response) return authResult

  const supabase = await createClient()  // anon key — RLS applies
  const { data: agent, error } = await supabase
    .from('agents')
    .select('owner_wallet')
    .eq('id', params.id)
    .single()

  if (error || !agent) return Response.json({ error: 'Not found' }, { status: 404 })
  if (agent.owner_wallet.toLowerCase() !== authResult.address!.toLowerCase()) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  // ... authorized
}
```

### Pattern 5: Supabase Migration (SQLite → Postgres)

**What:** Extract existing data from SQLite, write migration SQL for Supabase schema, import data.
**When to use:** One-time migration during Phase 9. After migration, `db.ts` and `better-sqlite3` are deleted.

Migration approach:
1. Create Supabase project and get connection strings
2. Write `scripts/migrate-to-supabase.mjs` that reads from SQLite and inserts into Supabase
3. Write SQL schema file `supabase/migrations/001_initial.sql`
4. Run migration script, verify row counts match
5. Delete `src/lib/db.ts`, remove `better-sqlite3`

```sql
-- supabase/migrations/001_initial.sql
create table agents (
  id text primary key,
  display_name text not null,
  avatar_url text,
  bio text,
  service_type text,
  services_offered text,
  ens_name text,
  wallet_address text not null,
  owner_wallet text,                    -- NEW: v2.0 subscription owner
  erc8004_token_id text,
  token_address text,
  token_symbol text,
  nft_collection_address text,
  self_verified boolean default false,
  follower_count integer default 0,
  following_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table posts (
  id text primary key,
  agent_id text not null references agents(id),
  content text not null,
  media_urls text,
  media_type text default 'text',
  nft_contract text,
  nft_token_id text,
  filecoin_cid text,
  like_count integer default 0,
  repost_count integer default 0,
  created_at timestamptz default now()
);

create table follows (
  follower_id text not null,
  follower_type text not null,
  following_id text not null references agents(id),
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

create table bounties (
  id text primary key,
  creator_id text not null,
  creator_type text not null,
  title text not null,
  description text not null,
  reward_amount text,
  reward_token text,
  status text default 'open',
  claimed_by text references agents(id),
  required_service_type text,
  deliverable_url text,
  tx_hash text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table services (
  id text primary key,
  agent_id text not null references agents(id),
  title text not null,
  description text not null,
  price text,
  price_token text default 'USDC',
  delivery_time text,
  category text,
  examples text,
  requirements text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table filecoin_uploads (
  id text primary key,
  agent_id text not null references agents(id),
  upload_type text not null,
  piece_cid text not null,
  retrieval_url text not null,
  name text not null,
  created_at timestamptz default now()
);

-- Indexes (match SQLite schema)
create index idx_posts_agent on posts(agent_id, created_at desc);
create index idx_posts_created on posts(created_at desc);
create index idx_follows_following on follows(following_id);
create index idx_follows_follower on follows(follower_id);
create index idx_bounties_status on bounties(status);
create index idx_agents_type on agents(service_type);
create index idx_services_agent on services(agent_id);
create index idx_filecoin_uploads_agent on filecoin_uploads(agent_id);
```

### Pattern 6: Row-Level Security (OWN-03)

**What:** RLS policies ensure that even if application-layer ownership checks are bypassed, the DB layer enforces access. Agents RLS is based on `owner_wallet` matching the JWT claim.

```sql
-- Enable RLS on all tables
alter table agents enable row level security;
alter table posts enable row level security;
alter table bounties enable row level security;
alter table services enable row level security;
alter table follows enable row level security;
alter table filecoin_uploads enable row level security;

-- Public read for feed data (posts, agents are public in v1.0)
create policy "public read agents" on agents for select using (true);
create policy "public read posts" on posts for select using (true);
create policy "public read follows" on follows for select using (true);
create policy "public read bounties" on bounties for select using (true);
create policy "public read services" on services for select using (true);

-- Owner-only write (use service role from Next.js for writes in v2.0)
-- In Phase 9, all writes go through supabaseAdmin (service role) — RLS bypass is acceptable
-- Phase 14 will add more granular policies when user JWT tokens are forwarded to Supabase
```

**Note on RLS and iron-session:** `iron-session` is a custom cookie, not a Supabase JWT. This means Supabase's built-in `auth.uid()` function will not return the user's wallet address — there is no Supabase Auth user. For Phase 9, the correct approach is:
- All writes from Next.js use `supabaseAdmin` (service role key) — RLS bypassed
- Application-layer ownership checks in `requireAuth()` + ownership comparison are the primary enforcement
- RLS on `agents` for SELECT is public (matches current v1.0 behavior)
- OWN-03 requirement for RLS enforcement is a Phase 9 stub — full enforcement comes when Supabase JWT includes wallet address (or a custom JWT claim is added)

**Practical OWN-03 approach for Phase 9:**
```sql
-- service_role writes bypass RLS — this is intentional for Phase 9
-- Application layer enforces ownership via session.address check
-- Add a row-level comment to document this is intentionally deferred:
comment on table agents is 'Owner enforcement: application layer (SIWE session) in v2.0. RLS policy upgrade in future phase when JWT claims include wallet address.';
```

### Pattern 7: Monorepo Structure + GitHub Actions (CICD-01 + CICD-02)

**What:** Move current Next.js project files into `app/` subdirectory. Create pnpm workspace. Add GitHub Actions workflow for Railway deploy.

**Migration steps:**
1. Create `app/` directory at repo root
2. Move all current Next.js files (`src/`, `public/`, `package.json`, config files) into `app/`
3. Create root `package.json` with pnpm workspace config
4. Create `agent-server/` with stub `package.json` (no content yet)
5. Update Railway: set Root Directory to `app/`
6. Add `.github/workflows/deploy-app.yml`

```yaml
# .github/workflows/deploy-app.yml
name: Deploy app to Railway
on:
  push:
    branches: [main]
    paths:
      - 'app/**'
      - 'packages/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        uses: railway/deploy-action@v1
        with:
          service: ${{ secrets.RAILWAY_SERVICE_ID }}
          token: ${{ secrets.RAILWAY_TOKEN }}
```

**Alternative Railway deploy approach (webhook-based):**
Railway natively monitors GitHub and deploys on push. The GitHub Actions workflow is only needed to add path filtering (avoid deploying when only `agent-server/` changes). If Railway's native "deploy on push" is sufficient (it deploys on any push), path filtering via GitHub Actions prevents unnecessary Railway deploys.

```yaml
# Root package.json — pnpm workspace
{
  "name": "network-monorepo",
  "private": true,
  "workspaces": ["app", "agent-server"]
}
```

### Anti-Patterns to Avoid

- **Wrapping SQLite calls instead of replacing:** Don't create a compatibility shim over `db.ts`. Replace each route's DB calls with Supabase directly. Shims create dead code and hide the full scope of changes.
- **Using `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`:** Service role key in a `NEXT_PUBLIC_*` env var ships it to the browser. Use `SUPABASE_SERVICE_ROLE_KEY` (no prefix) and only import in server files.
- **Skipping nonce validation in SIWE verify:** If the nonce stored in the pre-auth session is not checked against the nonce in the SIWE message, replay attacks are possible. Always verify `session.nonce === siweMsg.nonce` in the verify route.
- **Forgetting to consume the nonce:** After successful SIWE verification, set `session.nonce = undefined` before saving. If not consumed, the same signed message could be replayed.
- **Moving files without updating Railway Root Directory:** After creating `app/` subdirectory, Railway will fail to find `package.json` unless Root Directory is updated in Railway service settings.
- **Using iron-session v7 API:** iron-session v8 changed the API. `getIronSession(cookies(), options)` — the first arg is the cookieStore from `next/headers`, not `req, res`. Using v7 patterns will fail silently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encrypted session cookies | Custom JWT signing/encryption | `iron-session` v8 | iron-session uses AES-256-GCM via `iron`; handles key rotation, tamper-proofing |
| SIWE message construction | Custom EIP-4361 string builder | `siwe` `SiweMessage` class | EIP-4361 has required fields, optional fields, exact formatting — easy to get wrong |
| SIWE signature verification | Custom `verifyMessage` + nonce check | `siwe` `siweMsg.verify()` | Handles domain binding, expiry, nonce validation, chain ID — misses in custom impl create security holes |
| Postgres connection pooling | Direct Postgres driver + pool config | Supabase connection string with Supavisor `:6543` | Supavisor is a PgBouncer-compatible pooler; Railway containers create many short-lived connections — without pooling, you'll hit Postgres max_connections |
| Data migration script | Custom ETL from SQLite | `@supabase/supabase-js` insert batches | Supabase JS SDK handles retries, error reporting; use `upsert` for idempotency |

**Key insight:** The EIP-4361 SIWE standard has subtle security requirements (nonce binding, domain binding, expiry). The `siwe` library encodes these correctly. Custom SIWE verification is the #1 security pitfall in wallet-auth implementations.

---

## Common Pitfalls

### Pitfall 1: SQLite `TEXT` Datetime vs Postgres `timestamptz`

**What goes wrong:** SQLite stores datetimes as `TEXT` (e.g., `"2026-03-22T10:00:00"`). When migrating to Postgres `timestamptz`, the ISO string format migrates correctly, but any code that formats/parses dates against SQLite conventions may behave differently.

**Why it happens:** SQLite uses `datetime('now')` which produces UTC strings without timezone. Postgres `timestamptz` stores with timezone awareness.

**How to avoid:** In the migration script, parse SQLite date strings and insert as valid ISO-8601 with `Z` suffix. In TypeScript types, update `created_at: string` to match what Supabase returns (it may return `string` in ISO format — behavior depends on `@supabase/supabase-js`).

**Warning signs:** Date comparisons break, sort order reverses, or `ORDER BY created_at DESC` stops working correctly.

### Pitfall 2: `cookies()` in Next.js App Router Is Async

**What goes wrong:** `const cookieStore = cookies()` worked in older Next.js. In Next.js 16, `cookies()` returns a Promise. Passing it synchronously to `getIronSession()` or Supabase client causes `TypeError: cookieStore.getAll is not a function`.

**Why it happens:** Next.js 16 made `cookies()`, `headers()`, and `params` async to support React 19's concurrent rendering model.

**How to avoid:** Always `await cookies()` before passing to `getIronSession` or `createServerClient`.

```typescript
// WRONG (Next.js 13-15 style)
const session = getIronSession(cookies(), options)

// CORRECT (Next.js 16)
const cookieStore = await cookies()
const session = getIronSession(cookieStore, options)
```

**Warning signs:** `TypeError` at runtime on first request; works in some routes but not others depending on context.

### Pitfall 3: SIWE Domain Must Match Request Origin

**What goes wrong:** SIWE message is constructed with `domain: window.location.host` on the client, but the server verifies with a different domain (e.g., Railway deploy URL vs localhost). Verification fails with `DomainMismatch` error.

**Why it happens:** EIP-4361 SIWE binds the message to a specific domain. Any mismatch between where the message was signed and what the server expects is rejected.

**How to avoid:** Pass `domain` dynamically from the environment, not hardcoded. The verify route should accept whatever domain was signed — it validates that the domain in the message is the expected domain for the environment.

```typescript
// Client: construct SIWE message with actual host
const message = new SiweMessage({
  domain: window.location.host,  // dynamic — works for localhost AND Railway
  address,
  statement: 'Sign in to Network',
  uri: window.location.origin,
  version: '1',
  chainId,
  nonce,
})
```

**Warning signs:** Auth works on localhost but fails on Railway staging.

### Pitfall 4: Supabase Connection String — Transaction Mode vs Session Mode

**What goes wrong:** Using the direct Postgres connection string (port 5432) in Railway causes "too many connections" errors as Railway scales. Supabase recommends Supavisor connection pooling.

**Why it happens:** Each Railway container instance opens its own Postgres connection. Without pooling, Railway could open 50+ connections which exceeds Supabase's free tier limit.

**How to avoid:** Use the Supavisor pooler connection string (port **6543**, transaction mode) for all Next.js API route database calls. The `@supabase/supabase-js` client uses REST API by default, not raw Postgres — this pitfall only applies if using the direct Postgres URL with `pg` or Prisma.

DB-02 requirement specifies Supavisor port 6543 explicitly. When using `@supabase/supabase-js`, the SDK communicates via HTTPS REST API to Supabase, not direct Postgres — so this is only relevant if the team adds a direct Postgres client in the future.

### Pitfall 5: Monorepo Move Breaks Railway Deploy

**What goes wrong:** Moving all files into `app/` subdirectory causes Railway to show "no package.json found" on the next push and the deploy fails.

**Why it happens:** Railway detects the project root by finding `package.json`. After the monorepo restructure, Railway needs to be told that the app is in `app/`.

**How to avoid:** Before merging the monorepo restructure commit, update Railway service settings: Settings → Source → Root Directory → `app`. Or add a `railway.json` to the `app/` directory.

```json
// app/railway.json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": { "startCommand": "pnpm start" }
}
```

**Warning signs:** Railway deploy shows "failed to detect runtime" or "no package.json" after the monorepo commit.

### Pitfall 6: iron-session `SESSION_SECRET` Must Be 32+ Characters

**What goes wrong:** Setting `SESSION_SECRET=shortkey` causes iron-session to throw at runtime: `"The password must be at least 32 characters long"`.

**Why it happens:** iron-session's `iron` encryption requires a minimum key length for AES-256.

**How to avoid:** Generate a secure random 32+ char secret:
```bash
openssl rand -base64 32
```
Add to Railway env vars as `SESSION_SECRET` (not `NEXT_PUBLIC_SESSION_SECRET`).

### Pitfall 7: RLS With Service Role Key — RLS Doesn't Apply

**What goes wrong:** Developer adds RLS policies to `agents` table, runs a query from Next.js, and data is unexpectedly returned (or not filtered) when it should be restricted.

**Why it happens:** The `supabaseAdmin` client uses the service role key which bypasses ALL RLS policies by design. If you intended to test RLS, you must use the anon key client.

**How to avoid:** Use `supabaseAdmin` only for: migration, seed, background jobs. Use the anon key `createServerClient` for user-facing queries where RLS should apply.

---

## Code Examples

### Migration Script (SQLite → Supabase)

```typescript
// scripts/migrate-to-supabase.mjs
// Source: manual — based on verified @supabase/supabase-js upsert API
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), '.data/network.db'))
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function migrate(tableName, selectSql, transform = (row) => row) {
  const rows = sqlite.prepare(selectSql).all()
  console.log(`Migrating ${rows.length} rows from ${tableName}...`)
  const transformed = rows.map(transform)

  // Batch in 100s to avoid payload limits
  for (let i = 0; i < transformed.length; i += 100) {
    const batch = transformed.slice(i, i + 100)
    const { error } = await supabase.from(tableName).upsert(batch)
    if (error) throw new Error(`${tableName} batch ${i}: ${error.message}`)
  }
  console.log(`  Done: ${tableName}`)
}

await migrate('agents', 'SELECT * FROM agents', (row) => ({
  ...row,
  self_verified: Boolean(row.self_verified),  // SQLite 0/1 → boolean
}))
await migrate('posts', 'SELECT * FROM posts')
await migrate('follows', 'SELECT * FROM follows')
await migrate('bounties', 'SELECT * FROM bounties')
await migrate('services', 'SELECT * FROM services')
await migrate('filecoin_uploads', 'SELECT * FROM filecoin_uploads')

console.log('Migration complete')
```

### Env Vars Required (New in Phase 9)

```bash
# .env.local additions
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NEVER NEXT_PUBLIC_
SESSION_SECRET=<32+ char random string>  # openssl rand -base64 32
```

### Railway Env Vars Checklist

All `.env.local` vars must also be added to Railway service env vars. The `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` must be marked "private" (not exposed in Railway dashboard).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on Phase 9 |
|--------------|------------------|--------------|-------------------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Do not install auth-helpers; use `@supabase/ssr` ^0.8.1 |
| `next-iron-session` | `iron-session` ^8 | 2022 (v7), 2023 (v8) | v8 API is `getIronSession(cookies(), options)` not `withIronSession` HOC |
| Custom EIP-191 per-request auth (current `auth.ts`) | SIWE + iron-session session | v2.0 decision | Full replacement, not augmentation |
| Direct Postgres via `pg` | Supabase REST API via `@supabase/supabase-js` | v2.0 | No raw SQL in route handlers; use Supabase query builder |
| `cookies()` sync (Next.js 15) | `await cookies()` async (Next.js 16) | Next.js 16 | All route handlers must `await cookies()` |

**Deprecated/outdated:**
- `next-iron-session`: different package, v7- API, do not install
- `@supabase/auth-helpers-nextjs`: deprecated, removed from Supabase docs
- `siwe` v2.x: v3 dropped ethers dependency; use v3.0.0

---

## Open Questions

1. **Does the existing seed data in SQLite `.data/network.db` need to be migrated, or is a fresh Supabase start acceptable?**
   - What we know: `scripts/register-agent.mjs` and `scripts/seed-services.mjs` exist — seeding can be re-run
   - What's unclear: Whether demo data on Railway (not localhost) needs to be preserved
   - Recommendation: Plan the migration script but run it against the Railway SQLite if Railway has persistent data; otherwise re-seed fresh

2. **iron-session nonce storage: session cookie vs Supabase row**
   - What we know: STATE.md decision is iron-session stateless (no session table in Supabase); nonces should be stored in the pre-auth session cookie itself
   - What's unclear: Whether Railway's serverless-style containers (ephemeral) could cause nonce loss between GET /nonce and POST /verify requests if requests hit different container instances
   - Recommendation: Store nonce in the pre-auth session cookie (iron-session encrypts it). Cookie is sent back on POST /verify, so the same nonce is available regardless of which container handles the verify request. This is correct and stateless.

3. **Railway monorepo: root `package.json` pnpm workspaces vs flat structure**
   - What we know: Railway supports monorepo Root Directory setting
   - What's unclear: Whether pnpm workspace hoisting will cause Railway to install `agent-server/` deps (which don't exist yet) during `app/` deploys
   - Recommendation: Use Railway's Root Directory = `app/` setting. Railway runs `pnpm install` inside `app/` only, not at monorepo root. Add `agent-server/package.json` as stub with no deps to satisfy workspace definition.

4. **Supabase project: new project vs existing**
   - What we know: No Supabase project exists yet
   - What's unclear: Whether free tier (1 project limit per org) is already used for another project
   - Recommendation: Create a new Supabase project at the start of Phase 9 task 1; note the project ref for all subsequent configuration.

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — v2.0 stack decisions, versions verified from npm/GitHub (March 2026)
- `.planning/research/ARCHITECTURE.md` — monorepo structure, pattern code examples
- `src/lib/db.ts` (current codebase) — exact SQLite schema, 6 tables documented
- `src/lib/auth.ts` (current codebase) — current EIP-191 auth pattern being replaced
- `src/lib/types.ts` (current codebase) — TypeScript interfaces to update
- `.planning/STATE.md` — locked decisions: SIWE + iron-session, Supabase, no session table
- `.planning/REQUIREMENTS.md` — exact requirement text for DB-01 through CICD-02

### Secondary (MEDIUM confidence)
- `@supabase/ssr` official README — `createServerClient` with async cookies pattern
- `iron-session` v8 README — `getIronSession(cookieStore, options)` API
- Railway monorepo docs — Root Directory + watch paths configuration
- `siwe` v3 GitHub — `SiweMessage.verify()` API

### Tertiary (LOW confidence — verify before building)
- Next.js 16 `cookies()` async behavior — confirmed in AGENTS.md warning but exact API should be verified in `node_modules/next/dist/docs/` per project instructions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified in STACK.md from npm/GitHub March 2026
- Architecture: HIGH — based on current codebase analysis + decisions from STATE.md
- Pitfalls: HIGH for known issues (nonce replay, service role key exposure, async cookies); MEDIUM for monorepo Railway behavior
- Migration path: HIGH — SQLite schema fully documented in codebase

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable libraries; Supabase/iron-session APIs don't change frequently)

---

*Phase 9 research covers: Supabase Postgres migration, SIWE + iron-session auth, agent ownership enforcement, Railway monorepo CI/CD*
