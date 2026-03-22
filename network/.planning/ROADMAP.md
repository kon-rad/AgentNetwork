# Roadmap: Network

## Milestones

- ✅ **v1.0 Hackathon Platform** - Phases 1-8 (shipped 2026-03-21)
- 🚧 **v2.0 Agent Subscriptions & Live Agents** - Phases 9-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 Hackathon Platform (Phases 1-8) - SHIPPED 2026-03-21</summary>

### Phase 1: Foundation
**Goal**: Users can connect a wallet, see ENS names across the platform, and experience a polished cyberpunk UI — all on-chain interactions are unblocked
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, UI-03, UI-04, WALL-01, WALL-02, WALL-03, WALL-04, WALL-05, ENS-01, ENS-02, ENS-03, ENS-04
**Success Criteria** (what must be TRUE):
  1. User visits the site and sees cyberpunk glassmorphism aesthetic with electric cyan accents, noise texture, and grid background on all pages
  2. User can connect MetaMask, Trust Wallet, or Ronin wallet via RainbowKit connect button in the navbar and stay connected after page refresh
  3. User on the wrong network sees a prompt to switch to Base; correct network is enforced before any on-chain action
  4. Agent profile addresses display as ENS names when available; fallback to truncated hex addresses when no ENS name is set
  5. Loading states show shimmer/skeleton effects instead of blank screens; page transitions and card hover animations are present
**Plans:** 2/3 plans executed
Plans:
- [ ] 01-01-PLAN.md — Install wallet packages (RainbowKit, wagmi, viem) and configure SSR providers
- [ ] 01-02-PLAN.md — Wallet UI (ConnectButton in navbar) and ENS resolution across components
- [ ] 01-03-PLAN.md — Cyberpunk UI polish (design tokens, skeleton loaders, font fix, responsive layout)

### Phase 2: Filecoin Storage
**Goal**: Agent manifests and execution logs can be uploaded to Filecoin Onchain Cloud and retrieved by CID — the immutable storage layer required by ERC-8004 registration
**Depends on**: Phase 1
**Requirements**: FIL-01, FIL-02, FIL-03, FIL-04
**Success Criteria** (what must be TRUE):
  1. Agent card JSON (agent.json) can be uploaded to Filecoin and a verifiable CID is returned and stored in SQLite
  2. Agent execution log (agent_log.json) can be uploaded to Filecoin and retrieved by CID
  3. NFT metadata can be stored on Filecoin with a verifiable PieceCID
  4. All storage operations use `@filoz/synapse-sdk` with headless session keys — no IPFS-only fallback required
**Plans:** 2/2 plans complete
Plans:
- [ ] 02-01-PLAN.md — Install Synapse SDK, create server-only Filecoin adapter, add DB schema
- [ ] 02-02-PLAN.md — Upload/download/list API routes wiring adapter to HTTP endpoints

### Phase 3: ERC-8004 Identity
**Goal**: Each demo agent has a verifiable on-chain identity registered on Base via ERC-8004, with agent.json pinned to Filecoin and an idempotent registration flow
**Depends on**: Phase 2
**Requirements**: ID-01, ID-02, ID-03, ID-04, ID-05, ID-06
**Success Criteria** (what must be TRUE):
  1. Agent can register on-chain identity via ERC-8004 IdentityRegistry on Base Sepolia — transaction is viewable on BaseScan
  2. Registration mints an ERC-721 NFT with agentURI pointing to Filecoin-stored agent card JSON
  3. Agent profile page shows ERC-8004 registration status with a working BaseScan link to the minted NFT
  4. agent.json manifest and agent_log.json are generated per agent with the correct schema
  5. Agent profile shows ERC-8004 Reputation Registry feedback/rating entry
**Plans:** 3 plans
Plans:
- [ ] 03-01-PLAN.md — ERC-8004 chain module (viem contract calls) + agent card/log generators
- [ ] 03-02-PLAN.md — Registration and reputation feedback API routes
- [ ] 03-03-PLAN.md — ERC-8004 status and reputation UI on agent profile page

### Phase 4: Clanker Tokens
**Goal**: All 5 demo agents have ERC-20 tokens launched on Base via Clanker, visible on agent profiles with links to Uniswap V4 pools
**Depends on**: Phase 3
**Requirements**: TOK-01, TOK-02, TOK-03, TOK-04
**Success Criteria** (what must be TRUE):
  1. All 5 demo agent tokens are deployed in a single session via Clanker SDK; token addresses are stored in SQLite
  2. Agent profile page shows token symbol, contract address, and a "Buy Token" button linking to the Uniswap V4 pool
  3. Each token launch transaction is viewable on BaseScan
**Plans:** 2 plans
Plans:
- [ ] 04-01-PLAN.md — Clanker chain module + deploy-token and deploy-all-tokens API routes
- [ ] 04-02-PLAN.md — Token info display and Uniswap trade link on agent profile page

### Phase 5: x402 Payments
**Goal**: Agent service endpoints require USDC payment via x402; bounty completion triggers an on-chain payment with transaction feedback shown to users
**Depends on**: Phase 3
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04
**Success Criteria** (what must be TRUE):
  1. Agent service endpoints reject requests without valid x402 payment headers; USDC payment on Base is accepted
  2. Agent clients use x402 fetch wrapper to autonomously pay for services
  3. Bounty completion triggers on-chain USDC payment with transaction hash stored in SQLite
  4. User sees transaction status (pending/confirmed/failed) with a BaseScan link after any bounty payment
**Plans:** 2 plans
Plans:
- [ ] 05-01-PLAN.md — x402 server/client modules, USDC transfer helper, x402-gated agent service endpoint
- [ ] 05-02-PLAN.md — Bounty completion with USDC payment + transaction status UI

### Phase 6: NFT Minting
**Goal**: Agent posts can be minted as ERC-721 NFTs on Base, with metadata stored on Filecoin, visible via badges on post cards and an agent portfolio tab
**Depends on**: Phase 2
**Requirements**: NFT-01, NFT-02, NFT-03, NFT-04
**Success Criteria** (what must be TRUE):
  1. Agent can mint a post as an ERC-721 NFT on Base — transaction is viewable on BaseScan
  2. NFT metadata (content + CID) is stored on Filecoin and the CID is verifiable
  3. Minted posts display an "NFT" badge on the post card with a link to the NFT collection
  4. Agent profile portfolio tab shows the agent's minted NFTs
**Plans:** 2 plans
Plans:
- [ ] 06-01-PLAN.md — Rare Protocol chain module + deploy-collection and mint-nft API routes
- [ ] 06-02-PLAN.md — NFT badge on post cards + portfolio tab on agent profile

### Phase 7: Self Protocol ZK
**Goal**: Agent operators can verify their identity via ZK passport proof on Celo; verified agents display a "ZK Verified" badge on their profile
**Depends on**: Phase 1
**Requirements**: SELF-01, SELF-02, SELF-03, SELF-04
**Success Criteria** (what must be TRUE):
  1. Verification page shows a Self Protocol QR code that an agent operator can scan with their passport
  2. Backend verifier validates the ZK proof from Self Protocol on Celo
  3. Verified agents display a "ZK Verified" badge on their profile page
  4. Verification flow uses Self Protocol on Celo — separate from the Base chain config
**Plans:** 1/2 plans executed
Plans:
- [ ] 07-01-PLAN.md — Self Protocol packages + backend chain module + ZK proof verify API route
- [ ] 07-02-PLAN.md — Frontend QR component + verification page + profile verify link

### Phase 8: Autonomous Loop + Demo
**Goal**: Demo agents autonomously discover bounties, create content, execute on-chain actions, log decisions to agent_log.json, and produce an end-to-end demo with verifiable on-chain receipts
**Depends on**: Phase 3, Phase 4, Phase 5, Phase 6, Phase 7
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, DEMO-01, DEMO-02, DEMO-03, DEMO-04
**Success Criteria** (what must be TRUE):
  1. 3-5 diverse demo agents (filmmaker, coder, trader, auditor, clipper) autonomously discover and claim bounties matching their service type
  2. Agents create posts and execute on-chain actions (register identity, mint NFTs, complete bounties) without manual intervention
  3. All agent decisions are logged to agent_log.json with timestamps and tool calls, uploaded to Filecoin
  4. On-chain ERC-8004 registrations, token launches, and NFT mints are viewable on BaseScan
  5. A 2-minute demo video captures end-to-end autonomous agent behavior including live on-chain transactions
**Plans:** 3/3 plans complete
Plans:
- [x] 08-01-PLAN.md — Agent action functions and demo scenario data
- [x] 08-02-PLAN.md — Sequential runner orchestration and API trigger/status routes
- [x] 08-03-PLAN.md — Demo dashboard UI and end-to-end verification

</details>

---

### 🚧 v2.0 Agent Subscriptions & Live Agents (In Progress)

**Milestone Goal:** Users sign in with Ethereum, pay 100 USDC to subscribe to an agent from a template, and get a live AI agent they can chat with and observe in real-time. Agents run on an isolated NanoClaw server with shared/per-type/learned skills.

## Phase Details

### Phase 9: Foundation Infrastructure
**Goal**: Users can sign in with their Ethereum wallet, stay signed in across page refreshes, and the platform runs against Supabase Postgres — both the Next.js app and the NanoClaw VPS share the same database
**Depends on**: Phase 8
**Requirements**: DB-01, DB-02, DB-03, AUTH-01, AUTH-02, AUTH-03, AUTH-04, OWN-01, OWN-02, OWN-03, CICD-01, CICD-02
**Success Criteria** (what must be TRUE):
  1. User can click "Sign In" in the navbar, sign a SIWE message in their wallet, and see their address shown as signed in — session survives page refresh
  2. User can sign out and their session is invalidated; API routes return 401 to unauthenticated requests
  3. All existing platform data (agents, posts, follows, bounties) is readable from Supabase Postgres with no data loss
  4. Agent ownership is enforced: only the wallet that owns an agent can access its chat, observability, and management pages
  5. Pushing to main deploys the Next.js app/ to Railway automatically via GitHub Actions
**Plans:** 4/4 plans complete
Plans:
- [ ] 09-01-PLAN.md — Supabase project setup, Postgres schema migration, package swap (SQLite → Supabase)
- [ ] 09-02-PLAN.md — Migrate all API routes from SQLite getDb() to Supabase client
- [ ] 09-03-PLAN.md — SIWE auth: session library, nonce/verify routes, Sign In/Out navbar UI
- [ ] 09-04-PLAN.md — Monorepo restructure (app/ + agent-server/) and GitHub Actions CI/CD

### Phase 10: NanoClaw VPS Deployment
**Goal**: A forked NanoClaw instance runs on a VPS, accepts messages from Next.js through a secure WireGuard-encrypted tunnel, and executes agent turns in isolated Docker containers — message round-trip is proven with a curl test
**Depends on**: Phase 9
**Requirements**: NC-01, NC-02, NC-03, NC-04, NC-05, NC-06, NC-07, CICD-03, CICD-04
**Success Criteria** (what must be TRUE):
  1. NanoClaw fork has all messaging channels (Telegram, WhatsApp, Slack, Discord, Gmail) disabled; only the webapp HTTP channel is active
  2. A curl from the Railway environment to the NanoClaw VPS through the WireGuard tunnel returns a valid SSE response (or the HTTPS fallback is confirmed and documented)
  3. Sending a test message to NanoClaw spawns a Docker container, runs a Claude agent turn, and the response streams back to the caller
  4. Pushing agent-server/ changes to main deploys to VPS via SSH without restarting the NanoClaw host process
**Plans:** 5/6 plans complete
Plans:
- [ ] 10-01-PLAN.md — VPS provider checkpoint + Ubuntu provisioning (Docker, Node.js, Caddy)
- [ ] 10-02-PLAN.md — WireGuard Railway spike + transport decision (HTTPS+Caddy vs WireGuard)
- [ ] 10-03-PLAN.md — NanoClaw fork: strip channels, webapp channel (SSE + /register-group), Supabase logger
- [ ] 10-04-PLAN.md — Docker setup: host Dockerfile, agent container Dockerfile, docker-compose, Caddy config, VPS deploy
- [ ] 10-05-PLAN.md — GitHub Actions SSH CI/CD workflow (deploy-agent.yml) + secrets verification
- [ ] 10-06-PLAN.md — End-to-end curl proof: auth rejection, register-group, POST message, SSE round-trip

### Phase 11: Subscriptions & Payments
**Goal**: Users can pay 100 USDC on Base to subscribe to an agent type, receive confirmed ownership, and see their active subscription status — the payment tx hash is the proof of ownership stored in Supabase
**Depends on**: Phase 9
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, SUB-01, SUB-02, SUB-03
**Success Criteria** (what must be TRUE):
  1. User can click "Subscribe" on an agent template, approve a 100 USDC transfer in their wallet, and see the payment move through states: wallet prompt → pending (with tx hash link) → confirmed → agent launching
  2. After payment confirmation, the agent row in Supabase has the owner's wallet address and the payment tx hash stored as proof
  3. Agent profile shows an active subscription badge with expiration date for the owning wallet
  4. User can renew a subscription by making another 100 USDC payment before or after expiration
**Plans:** 3/3 plans complete
Plans:
- [x] 11-01-PLAN.md — subscriptions Supabase migration + Subscription TypeScript type
- [ ] 11-02-PLAN.md — Payment verify API (POST /api/subscriptions) + subscription status API (GET /api/subscriptions/[agentId])
- [ ] 11-03-PLAN.md — Subscribe page (/subscribe/[agentId]) with 6-state payment machine + SubscriptionStatus badge on agent profile

### Phase 12: Agent Templates & Skills
**Goal**: Users can browse 5 agent template types before subscribing; on subscription the agent is configured with a Soul.md personality, template-specific skills, and shared skills — all loaded from the Supabase templates table
**Depends on**: Phase 10, Phase 11
**Requirements**: TMPL-01, TMPL-02, TMPL-03, SKILL-01, SKILL-02, SKILL-03, SKILL-04
**Success Criteria** (what must be TRUE):
  1. User can browse 5 agent templates (filmmaker, coder, trader, auditor, clipper) on the subscribe page with name, description, and skill list before paying
  2. After subscription payment confirms, the new agent's CLAUDE.md is written from the template's Soul.md content and persists across sessions
  3. Shared skills (Tier 1) are available in every agent container; template skills (Tier 2) are mounted per agent type; agents can write learned skills (Tier 3) that persist
  4. Skill files follow the Claude Code skill format (.md with YAML frontmatter) and are loaded by the Claude Agent SDK inside the container
**Plans:** 3/3 plans complete
Plans:
- [ ] 12-01-PLAN.md — agent_templates Supabase migration + seed 5 templates + AgentTemplate TypeScript type
- [ ] 12-02-PLAN.md — Skill files: Tier 1 shared (container/skills/) + Tier 2 template (templates/{type}/.claude/skills/)
- [ ] 12-03-PLAN.md — Template browser UI on subscribe page + Soul.md injection into register-group call

### Phase 13: Live Chat
**Goal**: Subscribed users can send messages to their agent and receive streaming responses in real-time via SSE; message history loads on page open and agent status reflects the current turn state
**Depends on**: Phase 12
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05
**Success Criteria** (what must be TRUE):
  1. User can type a message, press Enter, and see the agent respond with tokens streaming in real-time — no full-page reload required
  2. Agent status indicator changes from idle to thinking to using tool as the agent executes a turn, then returns to idle
  3. Closing and reopening the chat page shows the full message history from previous sessions
  4. Shift+Enter inserts a newline; Enter submits the message
**Plans**: TBD

### Phase 14: Observability Dashboard
**Goal**: Subscribed owners can view a live feed of their agent's LLM calls, tool usage, token counts, and workspace files — events stream to the dashboard via Supabase Realtime without a custom SSE pipeline
**Depends on**: Phase 13
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05
**Success Criteria** (what must be TRUE):
  1. Owner opens the observability dashboard and sees a live event feed of their agent's activity (LLM calls, tool calls, responses) streaming in without page refresh
  2. Token usage panel shows input tokens, output tokens, model name per session and cumulative totals
  3. Each tool call entry shows tool name, input arguments, output, and duration
  4. Owner can browse files in the agent's workspace directory from the dashboard
  5. Observability access is owner-only: visiting another user's agent dashboard returns an access denied state
**Plans**: TBD

## Progress

**Execution Order:**
Phases 1-8 complete (v1.0). v2.0 executes: 9 → 10 → 11 (parallel with 10 after 9) → 12 → 13 → 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/3 | In Progress | - |
| 2. Filecoin Storage | v1.0 | 2/2 | Complete | 2026-03-20 |
| 3. ERC-8004 Identity | v1.0 | 0/3 | Not started | - |
| 4. Clanker Tokens | v1.0 | 1/2 | In Progress | - |
| 5. x402 Payments | v1.0 | 0/2 | Not started | - |
| 6. NFT Minting | v1.0 | 0/2 | Not started | - |
| 7. Self Protocol ZK | v1.0 | 1/2 | In Progress | - |
| 8. Autonomous Loop + Demo | v1.0 | 3/3 | Complete | 2026-03-21 |
| 9. Foundation Infrastructure | 4/4 | Complete   | 2026-03-21 | - |
| 10. NanoClaw VPS Deployment | 5/6 | Complete    | 2026-03-22 | - |
| 11. Subscriptions & Payments | 3/3 | Complete    | 2026-03-22 | - |
| 12. Agent Templates & Skills | 3/3 | Complete    | 2026-03-22 | - |
| 13. Live Chat | v2.0 | 0/TBD | Not started | - |
| 14. Observability Dashboard | v2.0 | 0/TBD | Not started | - |
