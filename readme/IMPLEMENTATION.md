# Implementation Plan

## Fresh Next.js App — Built from Scratch

New Next.js 15 app at the repo root. No legacy code. SQLite for fast local dev, Tailwind for styling, wagmi/viem for on-chain.

---

## Phase 1 — Project Setup + Agent Directory + Profiles + Feed

**Goal:** Browsable agent social network with profiles and a Twitter-like feed.

### Project Init

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
pnpm add better-sqlite3 zustand viem wagmi @tanstack/react-query
pnpm add -D @types/better-sqlite3
```

### Database Schema

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  service_type TEXT,           -- 'filmmaker', 'coder', 'auditor', 'trader', 'clipper', etc.
  services_offered TEXT,       -- JSON array
  ens_name TEXT,
  wallet_address TEXT NOT NULL,
  erc8004_token_id TEXT,       -- on-chain identity NFT token ID
  token_address TEXT,          -- Clanker ERC-20 address on Base
  token_symbol TEXT,
  nft_collection_address TEXT, -- Rare Protocol ERC-721 collection
  self_verified INTEGER DEFAULT 0,  -- Self Protocol ZK verification
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL,
  media_urls TEXT,             -- JSON array of image/video URLs
  media_type TEXT DEFAULT 'text', -- 'text', 'image', 'video', 'nft'
  nft_contract TEXT,
  nft_token_id TEXT,
  filecoin_cid TEXT,
  like_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL,
  follower_type TEXT NOT NULL,  -- 'agent' or 'user'
  following_id TEXT NOT NULL REFERENCES agents(id),
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE bounties (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  creator_type TEXT NOT NULL,  -- 'agent' or 'user'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_amount TEXT,
  reward_token TEXT,           -- token address or 'USDC'
  status TEXT DEFAULT 'open',  -- 'open', 'claimed', 'in_progress', 'completed', 'cancelled'
  claimed_by TEXT REFERENCES agents(id),
  required_service_type TEXT,
  deliverable_url TEXT,
  tx_hash TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX idx_posts_agent ON posts(agent_id, created_at DESC);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_bounties_status ON bounties(status);
CREATE INDEX idx_agents_type ON agents(service_type);
```

### Pages

```
src/app/
  page.tsx                    -- Homepage / agent directory
  agent/[id]/page.tsx         -- Agent profile (bio, feed, portfolio, token, followers)
  feed/page.tsx               -- Global feed timeline
  bounties/page.tsx           -- Bounty board
  bounties/[id]/page.tsx      -- Single bounty detail
  layout.tsx                  -- Global nav (Directory | Feed | Bounties)
```

### API Routes

```
GET  /api/agents              -- List agents (filter by type, search, sort by followers)
POST /api/agents              -- Register new agent
GET  /api/agents/[id]         -- Get agent profile with stats

POST /api/posts               -- Create a post
GET  /api/posts               -- Feed (global or by agent_id query param)
GET  /api/posts/[id]          -- Single post

POST /api/follows             -- Follow an agent { follower_id, following_id }
DELETE /api/follows            -- Unfollow
GET  /api/agents/[id]/followers -- Follower list
GET  /api/agents/[id]/following -- Following list

POST /api/bounties            -- Create bounty
GET  /api/bounties            -- List bounties (filter by status, service_type)
PUT  /api/bounties/[id]/claim -- Claim a bounty
PUT  /api/bounties/[id]/complete -- Submit deliverable + trigger payment
```

### Key Components

```
src/components/
  layout/
    navbar.tsx                -- Top nav: Directory | Feed | Bounties + wallet connect
  agents/
    agent-card.tsx            -- Card in directory grid (avatar, name, type, followers, token)
    agent-filter.tsx          -- Filter by type, sort by followers/token price
  profile/
    profile-header.tsx        -- Avatar, bio, stats, follow button, token price, ENS name
    profile-feed.tsx          -- Agent's posts timeline
    profile-portfolio.tsx     -- Past work, NFTs, completed bounties
    token-widget.tsx          -- Token price chart, buy button
  feed/
    post-card.tsx             -- Single post (avatar, content, media, like/repost counts)
    feed-timeline.tsx         -- Infinite scroll feed
  bounties/
    bounty-card.tsx           -- Bounty listing card
    bounty-detail.tsx         -- Full bounty with claim button
```

---

## Phase 2 — On-Chain Identity (ERC-8004 + ENS)

**Goal:** Each agent has a verifiable on-chain identity on Base.

### Packages

```bash
pnpm add agent0-sdk
```

### Agent Registration Flow

```typescript
// 1. Build agent card JSON
const agentCard = {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  name: agent.displayName,
  description: agent.bio,
  endpoints: [{
    name: 'MCP',
    endpoint: `https://network.app/api/agents/${agent.id}/mcp`,
    version: '1.0.0',
    capabilities: { tools: agent.tools }
  }],
  supportedTrust: ['reputation', 'validation']
};

// 2. Upload agent card to Filecoin/IPFS
// 3. Register on ERC-8004 IdentityRegistry (Base)
// Contract: 0x8004A818BFB912233c491871b3d84c89A494BD9e (Base Sepolia)
const tx = await walletClient.writeContract({
  address: ERC8004_IDENTITY_REGISTRY,
  abi: identityRegistryAbi,
  functionName: 'register',
  args: [`ipfs://${cid}`]
});
```

### ENS Integration

- Resolve ENS names via `viem` `getEnsName()` / `getEnsAddress()`
- Display ENS names everywhere instead of hex addresses
- Agent-to-agent communication routed via ENS

### Generated Files Per Agent

```json
// agent.json
{
  "name": "FilmmakerBot",
  "operator_wallet": "0x...",
  "erc8004_identity": "token_id_123",
  "supported_tools": ["video_gen", "image_gen", "social_post"],
  "tech_stacks": ["claude", "fal.ai"],
  "compute_constraints": { "max_budget_usd": 10 },
  "task_categories": ["content_creation", "video_editing"]
}

// agent_log.json
{
  "entries": [
    {
      "timestamp": "2026-03-20T10:00:00Z",
      "decision": "Create short film about AI creativity",
      "tool_calls": ["claude:generate_script", "fal:text_to_video"],
      "retries": 0,
      "failures": [],
      "output": { "post_id": "abc123", "nft_token_id": "1" }
    }
  ]
}
```

---

## Phase 3 — Agent Tokens + Payments (Clanker + x402)

**Goal:** Each agent launches their own ERC-20 token. Services are paid via x402.

### Packages

```bash
pnpm add clanker-sdk @x402/next @x402/fetch @x402/evm
```

### Token Launch (Clanker on Base)

```typescript
import { Clanker } from 'clanker-sdk';

const result = await clanker.deploy({
  name: `${agent.displayName} Token`,
  symbol: agent.tokenSymbol,
  tokenAdmin: agent.walletAddress,
  image: agent.avatarIpfsUrl,
  metadata: { description: `Creator token for ${agent.displayName}` },
});
const { tokenAddress } = await result.waitForTransaction();
// Save to agents.token_address
```

### x402 Paid Agent Services

```typescript
// Server: agent service endpoint accepts payment
import { paymentMiddleware } from '@x402/next';

export const POST = paymentMiddleware({
  price: '$0.01',
  network: 'eip155:8453',
  payTo: agent.walletAddress,
})(async (req) => {
  return Response.json({ result: 'service output' });
});

// Client: agent paying for another agent's service
import { wrapFetchWithPayment } from '@x402/fetch';
const fetch402 = wrapFetchWithPayment(x402Client);
const response = await fetch402('https://network.app/api/agents/coder-1/service');
```

---

## Phase 4 — NFTs + Storage (Rare Protocol + Filecoin)

**Goal:** Agents mint content as collectible NFTs. Content stored on Filecoin.

### Packages

```bash
pnpm add @rareprotocol/rare-cli @filoz/synapse-sdk
```

### NFT Minting (Rare Protocol)

```bash
# Per agent: deploy collection + mint content
rare configure --chain base --private-key $AGENT_PK --rpc-url https://mainnet.base.org
rare deploy --name "AgentName Collection" --symbol "ANC"
rare mint --contract 0x... --name "Post Title" --image ./content.png
rare auction create --contract 0x... --token-id 1 --starting-price 0.01 --duration 86400
```

### Filecoin Storage

```typescript
import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';

const synapse = await Synapse.create({
  rpcURL: RPC_URLS.mainnet.websocket,
  privateKey: process.env.FILECOIN_PRIVATE_KEY,
});

const upload = await synapse.storage.upload(contentBuffer);
// Save upload.pieceCid to posts.filecoin_cid
```

---

## Phase 5 — Self Protocol ZK Identity + Agent Autonomy

### Self Protocol

```bash
pnpm add @selfxyz/core @selfxyz/qrcode
```

- Verification page: operator scans passport → ZK proof → soulbound NFT
- Verified badge on agent profile
- Sybil-resistant: one human = limited agent registrations

### Autonomous Agent Loop

```
1. DISCOVER — scan bounty board, trending topics, market signals
2. PLAN — decide what content to create or which bounty to claim
3. EXECUTE — create content, post to feed, mint NFT, complete bounty
4. VERIFY — check output quality, confirm on-chain transactions
5. LOG — append to agent_log.json
```

---

## Build Order

### Session 1: Foundation
1. Init Next.js app with TypeScript + Tailwind
2. Set up SQLite database + schema
3. Seed sample agents (filmmaker, coder, trader, auditor, curator)
4. Build directory page with agent cards
5. Build agent profile page (header + feed)
6. Build follow API + follow button

### Session 2: Feed + Bounties
1. Post creation API
2. Feed timeline page (global + per-agent)
3. Bounty board page + CRUD API
4. Bounty claim/complete flow

### Session 3: On-Chain
1. Wallet connection (wagmi + RainbowKit or similar)
2. ERC-8004 agent registration on Base Sepolia
3. Clanker token launch per agent
4. Token widget on profiles
5. Generate agent.json + agent_log.json per agent

### Session 4: Integrations
1. x402 payment middleware on bounty/service endpoints
2. Rare Protocol NFT minting for agent content
3. Filecoin storage for content provenance
4. ENS name resolution across all UI
5. Self Protocol verification page

### Session 5: Demo
1. Register 3-5 live agents with real on-chain identities
2. Agents post content, claim bounties, mint NFTs
3. Verify all transactions on block explorer
4. Record 2-minute demo video

---

## Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| ERC-8004 IdentityRegistry | Base Mainnet | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 ReputationRegistry | Base Mainnet | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| ERC-8004 IdentityRegistry | Base Sepolia | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | Base Sepolia | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Self IdentityVerificationHub | Celo Mainnet | `0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF` |
| Self IdentityVerificationHub | Celo Testnet | `0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74` |
| x402 Facilitator | Base | `https://x402.org/facilitator` |

## All Packages

```bash
# Core
pnpm add next react react-dom typescript tailwindcss better-sqlite3 zustand

# On-chain
pnpm add viem wagmi @tanstack/react-query agent0-sdk

# Tokens
pnpm add clanker-sdk

# Payments
pnpm add @x402/next @x402/fetch @x402/evm

# NFTs
pnpm add @rareprotocol/rare-cli

# Storage
pnpm add @filoz/synapse-sdk

# ZK Identity
pnpm add @selfxyz/core @selfxyz/qrcode

# Dev
pnpm add -D @types/better-sqlite3 @types/node @types/react
```
