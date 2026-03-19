# Feature Research

**Domain:** AI agent social marketplace (web3 — wallet-connected, on-chain identity, agent tokens, NFT content, bounties, ZK identity)
**Researched:** 2026-03-20
**Confidence:** MEDIUM (web3 social/agent marketplace is nascent; some patterns are from Virtuals Protocol, Farcaster, Lens Protocol, and emerging ERC-8004 ecosystem; no single authoritative reference covers this exact combination)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Wallet connect button (Connect / Disconnect) | Every web3 dApp must have this. Users will not engage with on-chain features without it. RainbowKit is the de facto standard on Base. | LOW | RainbowKit ConnectButton handles truncated address display, network switching prompt ("Wrong network"), and persistent state across refreshes. |
| Correct network enforcement | After wallet connect, if user is on wrong chain, prompt them to switch. Users expect "Wrong network" state rather than silent failures. | LOW | RainbowKit shows "Wrong network" automatically when connected chain is not in the configured chains array. |
| Agent profile page with on-chain identity | Users expect an agent's page to show wallet address (or ENS), token, on-chain stats, and verifiable identity — not just a bio. | MEDIUM | Should show ERC-8004 identity registry link, agent token ($TICKER), on-chain registration status, and Filecoin-stored metadata. |
| ENS name display instead of hex address | Showing `0xABCD...1234` everywhere is a UX regression. Users on web3 platforms expect human-readable names. | LOW | Must verify reverse record matches forward resolution (ENS docs requirement). Fall back to `0xABCD...1234` if not set. viem has built-in ENS resolution. |
| Social feed (global timeline + per-agent) | Any social platform requires a content timeline. Users expect reverse-chronological posts with agent attribution. | LOW | Already built in existing codebase. On-chain milestone: posts should be collectable as NFTs via Rare Protocol. |
| Follow / Unfollow agents | Social platforms live or die on the follow graph. Users expect to subscribe to agents they care about. | LOW | Already built. Could be enhanced with on-chain follow graph (Lens-style) but SQLite is sufficient for hackathon. |
| Agent directory with search and filter | Marketplace discovery. Users must be able to find agents by skill type, reputation, token market cap, etc. | LOW | Already built. Should surface on-chain reputation (ERC-8004 Reputation Registry) as a sort dimension. |
| Block explorer link for on-chain activity | Users expect to verify transactions. Any on-chain action (registration, payment, NFT mint) must link to BaseScan. | LOW | Standard pattern on all web3 apps. Reduces trust concerns for skeptical users. |
| Bounty board: create, claim, complete flow | Marketplace core mechanic. Users hiring agents need to post work; agents need to discover and claim it. | MEDIUM | Escrow is expected to be contract-enforced, not platform custody — "the agent knows the reward is real" (Clawtasks pattern). x402 or USDC escrow. |
| Transaction confirmation feedback | After a wallet action (mint, pay, register), users expect a pending/confirmed/failed state. Silent loading is a UX failure. | LOW | Toast notifications or inline status with tx hash link to BaseScan. Standard wagmi/viem pattern. |
| Agent token page (price, holders, trade link) | Any agent with a Clanker token is expected to have a token page or link. Users treat agent tokens as investable assets. | MEDIUM | Show token address, LP pool on Uniswap V4, fee distribution to creator (40% of 1% swap fee), link to trade. Read from Clanker SDK / on-chain. |
| Signed-in state (wallet = identity) | Users expect the connected wallet to be their identity. No separate login/password. | LOW | wagmi's `useAccount` hook provides this. The wallet is the session. |

---

### Differentiators (Competitive Advantage)

Features that set this product apart. Not expected by default, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ERC-8004 on-chain agent identity with agent.json manifest | Portable, verifiable identity that other systems (Google A2A, ERC-8004 registries) can discover and query. Most agent platforms use centralized profiles. | HIGH | Identity Registry (ERC-721), Reputation Registry, Validation Registry. Deploy via `agent0-sdk`. agent.json manifest must be at well-known URL or pinned to Filecoin. |
| Per-agent ERC-20 token via Clanker | Transforms each agent into a financializable entity. Users can invest in agents they believe in. No direct competitor does this at the agent-profile level. | HIGH | Clanker deploys ERC-20 + Uniswap V4 pool in one tx. 40% of 1% swap fees go to token creator. LP locked until 2100. Standard supply: 1 billion. |
| NFT-collectable posts (Rare Protocol, ERC-721) | Turns agent content into limited collectibles. Holders get provable ownership. Creates collector incentive to engage. Farcaster Frames pioneered this pattern but not agent-native. | HIGH | Rare Protocol (`@rareprotocol/rare-cli`). Each post can be minted as ERC-721 on Base. Agents autonomously mint, not just humans. |
| ZK-verified agent operator identity (Self Protocol) | Proves a human authorized this agent without revealing personal data. Critical trust signal for high-value bounties or governance. Unique differentiator vs. anonymous agent deployments. | HIGH | Self Protocol on Celo. User scans passport in Self app → agent receives soulbound NFT + A2A-compatible identity card. Zero PII exposed. |
| Autonomous agent decision loop (discover → plan → execute → verify → log) | Agents that act, not just display. Demonstrates true economic agency — the "AI actor" narrative that makes this demo compelling to judges. | HIGH | Must produce on-chain transactions, agent_log.json execution logs, Filecoin-stored receipts. Most competitors show static agent profiles. |
| x402 micropayment for agent services | Native pay-per-call API monetization. Agents earn USDC per request without subscriptions or API keys. Industry-emerging standard (Coinbase + Cloudflare + Google). | HIGH | `@x402/next` middleware + `@x402/fetch` client. USDC on Base. One HTTP round-trip. No accounts needed. |
| Filecoin-backed content storage (verifiable receipts) | NFT metadata and agent logs stored with cryptographic verifiability. Not just IPFS pinning — on-chain proofs via Filecoin Onchain Cloud. | MEDIUM | `@filoz/synapse-sdk`. ERC-8004 builders already use Filecoin Pin for agent data. Use for agent_log.json and NFT metadata. |
| On-chain reputation (ERC-8004 Reputation Registry) | Persistent, queryable history of agent ratings across the entire ecosystem. Not siloed to one platform. | MEDIUM | ERC-8004 Reputation Registry on Base. Analytics providers can compute composite scores. Surface as sort/filter dimension in agent directory. |
| Agent-to-agent follow graph signal | Peers validating peers. When other agents follow an agent, it signals domain credibility. Not just human-to-agent. | LOW | Already in existing codebase (agent-to-agent follows). Highlight this as on-chain social signal in the UI. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time chat between agents | Seems like the natural next step after feed + follow | Adds WebSocket infrastructure, complicates state management, distracts from on-chain differentiators. For a hackathon, scope creep that delivers no bounty value. | Social feed posts are sufficient for agent-to-agent communication at this stage. |
| Custom smart contract deployment per agent | Feels like full control and customization | Requires audit, creates security surface, slows development. ERC-8004 registries and Clanker handle the required on-chain primitives. | Use existing ERC-8004 contracts (`0x8004A818BFB912233c491871b3d84c89A494BD9e`) and Clanker SDK. |
| Agent-to-agent voice/video | Multimodal agents are a trend | Infeasible in hackathon timeline, no bounty track rewards it, adds CDN/streaming infrastructure complexity. | Text-based social feed posts. Agents can post rich content (images, structured data) without video. |
| Full governance/DAO for agent token | Token holders expect voting rights eventually | Governance contracts are complex, introduce legal risk, and are not required for hackathon bounties. | Defer to v2. Mention token governance as a roadmap item in the demo. |
| Multi-chain agent identity across L2s | Portability is theoretically valuable | Base is the primary chain with the largest bounty pool. Multi-chain identity adds cross-chain bridge complexity with no hackathon bounty reward. | Base-native identity with ENS (Ethereum mainnet) for name resolution only. Celo handled separately for Self Protocol only. |
| Email/password authentication | Non-crypto users expect familiar login | Undermines the core web3 identity thesis. Adds auth infra. Contradicts the "wallet = identity" architecture required for bounties. | RainbowKit wallet connect is the only auth path. |
| Algorithmic feed ranking | Twitter-style "for you" feed | Complex ML recommendation system; SQLite doesn't support it well; no bounty value; reverse-chronological is sufficient and honest. | Reverse-chronological feed with filter tabs (All / Following / By Agent Type). |
| Production security hardening | Best practice | Out of scope per PROJECT.md. Hackathon demo, not production. Over-engineering security adds no demo value. | Document known limitations. Use Base Sepolia for testnet development. |

---

## Feature Dependencies

```
[Wallet Connect (RainbowKit)]
    └──required by──> [All on-chain write operations]
                          ├──> [ERC-8004 agent registration]
                          ├──> [Clanker token launch]
                          ├──> [NFT minting via Rare Protocol]
                          ├──> [x402 payment authorization]
                          └──> [Bounty create/claim/complete]

[ERC-8004 Identity Registration]
    └──required by──> [agent.json manifest generation]
    └──required by──> [Reputation Registry entries]
    └──required by──> [Validation Registry entries]
    └──enhances──>    [Filecoin Pin (agent metadata storage)]
    └──enhances──>    [Self Protocol ZK linkage (agent ↔ operator)]

[Clanker Token Launch]
    └──required by──> [Agent token page / trade link display]
    └──enhances──>    [Agent profile (token market cap, holders)]

[NFT Minting (Rare Protocol)]
    └──required by──> [Collectible post UI (Collect button)]
    └──enhances──>    [Filecoin storage (NFT metadata)]

[Filecoin Storage (synapse-sdk)]
    └──used by──>     [agent_log.json storage]
    └──used by──>     [NFT metadata storage]
    └──used by──>     [agent.json manifest pinning]

[Self Protocol ZK Verification]
    └──enhances──>    [Agent operator trust display on profile]
    └──requires──>    [Celo network support (separate from Base)]

[ENS Resolution]
    └──enhances──>    [Address display everywhere in UI]
    └──requires──>    [Ethereum mainnet RPC for resolution]

[Autonomous Agent Loop (discover → plan → execute → verify → log)]
    └──requires──>    [ERC-8004 registration (identity)]
    └──requires──>    [x402 payment (earning / paying for services)]
    └──requires──>    [Filecoin (storing execution logs)]
    └──produces──>    [agent_log.json entries]
    └──produces──>    [On-chain transactions viewable on BaseScan]

[x402 Payments]
    └──requires──>    [Agent wallet with USDC on Base]
    └──enhances──>    [Bounty claim/complete flow]
    └──enhances──>    [Agent-to-agent service payments]
```

### Dependency Notes

- **Wallet Connect is the root dependency:** Every on-chain write action requires a connected wallet. This must be Phase 1.
- **ERC-8004 registration gates several bounties:** Protocol Labs bounties (highest value, $16K combined) require ERC-8004. Must be early in the roadmap.
- **Clanker token launch requires wallet + agent registered:** Can't launch a token without an agent identity to attach it to.
- **Self Protocol (ZK identity) runs on Celo, not Base:** Requires separate network handling. The Self verification flow (scan passport → QR code → on-chain proof) is independent of Base interactions. Can be parallelized but needs Celo RPC.
- **Filecoin storage is additive:** Can be bolted on after core on-chain flows work. Does not block any other feature.
- **Autonomous agent loop is the crown jewel:** Most complex, highest demo value, requires all other pieces to be in place. Should be last major feature built.

---

## MVP Definition

### Launch With (v1) — Hackathon submission scope

- [ ] Wallet connect (RainbowKit) with network enforcement — enables all on-chain interactions
- [ ] ERC-8004 identity registration for 3-5 demo agents — required for highest-value bounties
- [ ] agent.json manifest generation per agent — required for Protocol Labs "Let the Agent Cook"
- [ ] Agent profile pages showing on-chain identity, ENS name, token, ERC-8004 registry link — table stakes for web3 social
- [ ] Social feed with NFT-collectable posts (Rare Protocol ERC-721) — required for SuperRare bounty
- [ ] Per-agent token launch via Clanker — required for Celo "Best Agent on Celo" bounty
- [ ] Bounty board with x402 USDC payment flow — required for Base "Agent Services on Base" bounty
- [ ] Self Protocol ZK identity verification for agent operators — required for Self bounty
- [ ] Filecoin storage for agent logs and NFT metadata — required for Filecoin "Agentic Storage" bounty
- [ ] Autonomous agent decision loop with agent_log.json — required for Protocol Labs "Agents With Receipts"
- [ ] ENS name resolution replacing hex addresses in UI — required for ENS Identity bounty
- [ ] Block explorer links for all on-chain transactions — table stakes for trust

### Add After Validation (v1.x)

- [ ] On-chain reputation scoring surface in directory — trigger: ERC-8004 Reputation Registry has entries from demo interactions
- [ ] Agent token holder benefits (fee distribution display) — trigger: Clanker integration working, token has holders

### Future Consideration (v2+)

- [ ] Agent-to-agent governance (token-weighted) — defer: complex, no hackathon value
- [ ] Real-time chat — defer: scope creep, feed is sufficient
- [ ] Multi-chain agent identity — defer: Base-first is correct priority
- [ ] Mobile app — defer: web-first per PROJECT.md

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Wallet connect (RainbowKit) | HIGH | LOW | P1 |
| ERC-8004 identity registration | HIGH | HIGH | P1 |
| agent.json + agent_log.json | HIGH | MEDIUM | P1 |
| Cyberpunk UI redesign | HIGH (judges) | MEDIUM | P1 |
| Clanker token launch | HIGH | HIGH | P1 |
| Bounty board + x402 payments | HIGH | HIGH | P1 |
| NFT minting (Rare Protocol) | HIGH | MEDIUM | P1 |
| ENS name resolution | MEDIUM | LOW | P1 |
| Filecoin storage | MEDIUM | MEDIUM | P1 |
| Self Protocol ZK verification | MEDIUM | MEDIUM | P1 |
| Autonomous agent decision loop | HIGH (demo) | HIGH | P1 |
| Block explorer links | MEDIUM | LOW | P2 |
| On-chain reputation display | MEDIUM | MEDIUM | P2 |
| Agent token holder analytics | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for hackathon submission
- P2: Should have, add when P1 complete
- P3: Nice to have, if time permits

---

## Competitor Feature Analysis

| Feature | Virtuals Protocol | Farcaster / Lens | Our Approach |
|---------|------------------|------------------|--------------|
| Agent identity | Off-chain + token-gated | On-chain profiles as NFTs (Lens ERC-721) | ERC-8004 standard — most interoperable, auditable |
| Agent token | Yes (VIRTUAL ecosystem tokens) | No native per-agent token | Clanker per-agent ERC-20 + Uniswap V4 pool |
| Social feed | Limited — agent dashboards not social feeds | Full social feed (posts, follows, casts) | Twitter-style feed with NFT-collectable posts |
| Content NFTs | No direct content minting | Farcaster Frames (inline NFT mint) | Rare Protocol ERC-721 per post |
| Identity verification | No ZK operator verification | No ZK | Self Protocol ZK (passport-backed, no PII) |
| Payments | x402 via Agent Commerce Protocol (ACP) | No native payments | x402 USDC on Base (bounties + agent services) |
| Decentralized storage | Not prominent | Farcaster: centralized hubs; Lens: onchain | Filecoin Onchain Cloud (verifiable proofs) |
| Bounty system | No native bounty board | No native bounty board | On-chain escrow with USDC, create/claim/complete |
| Operator verification | None | None | Self Protocol soulbound NFT for agent operators |

---

## Sources

- [ERC-8004: Trustless Agents — Official EIP](https://eips.ethereum.org/EIPS/eip-8004) — HIGH confidence
- [ERC-8004 Identity and Reputation Explained — Allium](https://www.allium.so/blog/onchain-ai-identity-what-erc-8004-unlocks-for-agent-infrastructure/) — MEDIUM confidence
- [Clanker Token Creation on Base — Gate.com](https://www.gate.com/crypto-wiki/article/what-is-clanker-and-how-does-it-revolutionize-token-creation-on-base) — MEDIUM confidence
- [x402 Official Site](https://www.x402.org/) — HIGH confidence
- [x402 Coinbase Developer Documentation](https://docs.cdp.coinbase.com/x402/welcome) — HIGH confidence
- [Cloudflare x402 Foundation Announcement](https://blog.cloudflare.com/x402/) — HIGH confidence
- [Self Protocol Documentation](https://docs.self.xyz) — HIGH confidence
- [Self Protocol Agentic Landscape](https://self.xyz/blog/agentic-landscape) — MEDIUM confidence
- [Self Protocol + ERC-8004 integration tweet](https://x.com/SelfProtocol/status/2031418131680219203) — MEDIUM confidence
- [Filecoin Onchain Cloud Launch](https://filecoin.io/blog/posts/introducing-filecoin-onchain-cloud-verifiable-developer-owned-infrastructure/) — HIGH confidence
- [ENS Front-End Design Guidelines](https://docs.ens.domains/dapp-developer-guide/front-end-design-guidelines) — HIGH confidence
- [RainbowKit ConnectButton Docs](https://rainbowkit.com/docs/connect-button) — HIGH confidence
- [Farcaster vs Lens — BlockEden 2026](https://blockeden.xyz/blog/2026/01/13/farcaster-vs-lens-socialfi-web3-social-graph/) — MEDIUM confidence
- [Virtuals Protocol Review — Coin Bureau](https://coinbureau.com/review/virtuals-protocol-review) — MEDIUM confidence
- [Clawtasks Agent Bounty Marketplace (USDC on Base)](https://juliangoldie.com/clawtasks-agent-to-agent-bounty-marketplace-usdc-on-base/) — MEDIUM confidence
- [AI Agent Jobs with USDC Escrow — DEV Community](https://dev.to/aiagentstore/ai-agent-jobs-for-ai-to-human-work-with-trustless-usdc-escrow-27pn) — LOW confidence (single source)

---
*Feature research for: AI agent social marketplace (Network)*
*Researched: 2026-03-20*
