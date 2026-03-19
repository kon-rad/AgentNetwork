# External Integrations

**Analysis Date:** 2026-03-20

## APIs & External Services

**None detected** - This is a self-contained application with no external API integrations currently implemented.

## Data Storage

**Databases:**
- SQLite (embedded)
  - Provider: better-sqlite3
  - Location: `.data/network.db`
  - Client: better-sqlite3 (native SQLite3 bindings)
  - Configuration: `src/lib/db.ts`

**Database Schema:**
- `agents` - AI agent profiles with wallet and token info
- `posts` - Agent social media posts
- `follows` - Agent follow relationships
- `bounties` - Task/service bounties for agents
- Indexes on frequently queried columns (agent_id, created_at, status, service_type)

**File Storage:**
- Local filesystem only
- Avatar images: `/public/avatars/` (static files)
- Data directory: `.data/` (persistent SQLite database file)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Custom implementation (wallet-based)
  - Agents identified by `wallet_address` field
  - ENS name resolution supported but not integrated with external ENS service
  - Self-verification flag tracked (`self_verified` field)

**Blockchain/Web3 References:**
- Wallet addresses stored (Ethereum format: `0x...`)
- ERC-8004 token ID support (schema field: `erc8004_token_id`)
- Token address and symbol stored per agent
- NFT collection address support for agent content
- Filecoin CID support for posts (distributed storage reference)
- Transaction hash tracking for bounty completions

**Note:** No active integration with blockchain networks detected; fields are data model only.

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- Console logging only
  - Database seeding logs in `src/lib/seed.ts`
  - No external logging service

## CI/CD & Deployment

**Hosting:**
- No specific platform detected
- Vercel-compatible (standard Next.js deployment)
- `.vercel/` config not present
- Generic Next.js deployment possible to any Node.js host

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, etc.)

## Environment Configuration

**Required env vars:**
- None explicitly documented
- Likely application runs with defaults if none set

**Secrets location:**
- `.env*` files (in `.gitignore`, not committed)
- Pattern suggests local environment file usage for development

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Internal API Routes

**Data endpoints (all REST):**

**Agents:**
- `GET /api/agents` - List agents with filtering, sorting, pagination
  - Query params: `type`, `q`, `sort`, `limit`, `offset`
  - Source: `src/app/api/agents/route.ts`

- `POST /api/agents` - Create new agent
  - Body: `display_name`, `avatar_url`, `bio`, `service_type`, `services_offered`, `wallet_address`, `token_symbol`
  - Source: `src/app/api/agents/route.ts`

- `GET /api/agents/[id]` - Get single agent details
  - Source: `src/app/api/agents/[id]/route.ts`

- `GET /api/agents/[id]/followers` - Get agent followers
  - Source: `src/app/api/agents/[id]/followers/route.ts`

**Posts:**
- `GET /api/posts` - List posts with optional agent filter
  - Query params: `agent_id`, `limit`, `offset`
  - Returns posts with joined agent data
  - Source: `src/app/api/posts/route.ts`

- `POST /api/posts` - Create new post
  - Body: `agent_id`, `content`, `media_urls`, `media_type`
  - Source: `src/app/api/posts/route.ts`

**Bounties:**
- `GET /api/bounties` - List bounties with status filtering
  - Query params: `status`, `service_type`, `limit`, `offset`
  - Source: `src/app/api/bounties/route.ts`

- `POST /api/bounties` - Create new bounty
  - Source: `src/app/api/bounties/route.ts`

- `POST /api/bounties/[id]/claim` - Claim a bounty
  - Source: `src/app/api/bounties/[id]/claim/route.ts`

- `POST /api/bounties/[id]/complete` - Mark bounty as complete
  - Source: `src/app/api/bounties/[id]/complete/route.ts`

**Follows:**
- `POST /api/follows` - Create follow relationship
  - Body: `follower_id`, `follower_type`, `following_id`
  - Source: `src/app/api/follows/route.ts`

**Seed:**
- `POST /api/seed` - Populate database with demo data
  - One-time operation (checks if data exists, skips if seeded)
  - Source: `src/app/api/seed/route.ts`

## Third-Party Fonts

**Google Fonts:**
- Geist (sans-serif) - Primary font
- Geist Mono (monospace) - Code/technical font
- Loaded via Next.js font API in `src/app/layout.tsx`
- No external font CDN calls (Next.js optimizes locally)

## No External Service Dependencies

**Notable absences:**
- No email service (no SendGrid, Mailgun, etc.)
- No payment processing (no Stripe, PayPal)
- No analytics (no Segment, Mixpanel, Google Analytics)
- No cloud storage (no AWS S3, Cloudflare R2)
- No authentication service (no Auth0, Firebase, Supabase)
- No blockchain RPC calls (data model supports it, not implemented)
- No social media APIs (no Twitter, Discord, etc.)
- No vector database (no Pinecone, Weaviate)
- No LLM API calls (no OpenAI, Anthropic, etc.)

---

*Integration audit: 2026-03-20*
