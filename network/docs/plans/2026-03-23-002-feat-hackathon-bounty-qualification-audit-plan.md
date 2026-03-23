---
title: "Hackathon Bounty Qualification Audit & Submission Readiness"
type: feat
status: active
date: 2026-03-23
---

# Hackathon Bounty Qualification Audit & Submission Readiness

## Overview

Audit of Network's qualification status across all Synthesis hackathon bounty tracks, with gap analysis and submission checklist. **Today is March 23 — judging started today and runs through March 25.** AI agent judges will interact with live deployments during this window.

## Critical Timeline

- **Building period:** March 13–22 (ENDED)
- **Judging window:** March 23–25 (STARTED TODAY)
- **Registration deadline:** March 23 (TODAY)
- **Requirement:** Live deployment must be up during judging — agentic judges cannot evaluate unreachable projects

---

## Bounty Qualification Matrix

### TIER 1: Strong Qualification (Core features built)

| Bounty | Max Prize | Qualification | What We Have | Gaps |
|--------|-----------|---------------|-------------|------|
| **Synthesis Open Track** | $28,134 | ✅ STRONG | Full platform: agent directory, social feed, bounties, tokens, NFTs, Filecoin, ERC-8004, x402, Self Protocol ZK | Submit to main track — aligns with all 4 core themes |
| **Protocol Labs "Let the Agent Cook"** | $4,000 | ✅ STRONG | Phase 8 autonomous loop: discover-plan-execute-verify cycle, ERC-8004 identity, agent.json, agent_log.json, multi-tool orchestration | Minor: demo-dashboard response parsing bug (line 159). Demo video (DEMO-04) not yet recorded |
| **Protocol Labs "Agents With Receipts"** | $4,000 | ✅ STRONG | ERC-8004 identity + on-chain registrations, Filecoin uploads, USDC bounty payments with tx hashes, BaseScan verification | All on-chain receipts verifiable |
| **Base "Agent Services on Base"** | $5,000 | ✅ STRONG | x402-gated agent service endpoint ($0.01 USDC), discoverable agents, all on Base Sepolia | Exactly what this bounty asks for |
| **Filecoin "Agentic Storage"** | $2,000 | ✅ STRONG | Full Filecoin integration: agent_card, agent_log, nft_metadata uploads via Synapse SDK, download by CID | Note: bounty says "mainnet deployment" — we use calibration testnet. May need mainnet |
| **SuperRare Partner Track** | $2,500 | ✅ STRONG | ERC-721 deployment via Rare Protocol, Filecoin metadata, minting posts as NFTs, portfolio display | Need to verify autonomous minting works without human intervention for judges |
| **ENS Identity** | $1,500 | ✅ MODERATE | ENS resolution on agent profiles (display names), `ens_name` field in agent schema, RainbowKit ENS support | ENS is used for display but not as "primary identity layer" — could strengthen |
| **Self Protocol** | $1,000 | ✅ STRONG | ZK passport verification via Self Protocol on Celo, QR code flow, "ZK Verified" badge, anti-sybil | Identity is load-bearing (badge gating) |

### TIER 2: Possible Qualification (Partial fit or stretch)

| Bounty | Max Prize | Qualification | What We Have | Gaps |
|--------|-----------|---------------|-------------|------|
| **Celo "Best Agent on Celo"** | $5,000 | ⚠️ PARTIAL | Self Protocol ZK verification runs on Celo | Main app is on Base, not Celo. Only the ZK verification touches Celo. Judges may want deeper Celo integration (payments, stablecoins) |
| **Base "Autonomous Trading Agent"** | $5,000 | ❌ NO | No trading functionality built | Would need a novel trading agent — not feasible in judging window |
| **Uniswap "Agentic Finance"** | $4,500 | ⚠️ PARTIAL | Clanker tokens deployed with Uniswap V4 pool links | No actual swap execution. Bounty requires "functional swaps with real TxIDs" — we just link to Uniswap |

### TIER 3: Not Applicable

| Bounty | Max Prize | Why Not |
|--------|-----------|---------|
| Venice "Private Agents" | $11,500 | Requires Venice API for privacy-preserving inference — not integrated |
| Lido Labs | $9,500 | Requires stETH/wstETH yield strategies — not built |
| EigenCloud | $5,000 | Requires Docker on EigenCompute — different infra |
| OpenServ | $5,000 | Requires OpenServ as core infrastructure — not used |
| Bankr | $5,000 | Requires Bankr LLM Gateway + wallets — not integrated |
| MetaMask Delegations | $5,000 | Requires ERC-7715 delegation framework — not built |
| MoonPay | $7,000 | Requires OpenWallet Standard or MoonPay CLI — not used |
| Octant | $3,000 | Public goods evaluation — different domain |
| Locus | $3,000 | Requires Locus payment infrastructure — not integrated |
| Olas | $3,000 | Requires Pearl agent or Olas Marketplace — not used |
| Status Network | $2,000 | Requires deploy on Status Sepolia — different chain |
| Slice | $2,200 | Requires ERC-8128 / Slice Hooks — not built |
| bond.credit | $1,500 | Requires live GMX perps trading — not built |
| Arkhai | $900 | Requires Alkahest or escrow extensions — not built |
| Merit/AgentCash | $1,750 | Requires AgentCash SDK — not integrated |
| Ampersend | $500 | Requires ampersend-sdk — not used |
| Markee | $800 | Requires GitHub integration — different scope |
| College.xyz | $2,500 | Students only |
| Lit Protocol | $250 | Requires TEE-secured private data — not built |

---

## Realistic Prize Potential

| Track | Prize Range | Confidence |
|-------|------------|------------|
| Open Track | $1,000–$5,000 | HIGH — strong multi-integration project |
| Protocol Labs (x2 bounties) | $2,000–$4,000 | HIGH — built exactly to spec |
| Base "Agent Services" | $1,667 | MEDIUM — competitive track (3 equal winners) |
| Filecoin | $300–$1,000 | MEDIUM — need to verify mainnet vs testnet |
| SuperRare | $800–$1,200 | MEDIUM — need to verify autonomous minting |
| ENS | $300–$600 | LOW-MEDIUM — integration is display-only |
| Self Protocol | $1,000 | HIGH — winner-takes-all, strong integration |
| **Total realistic range** | **$7,067–$17,467** | |

---

## Submission Checklist

### Deployment & Infrastructure

- [ ] **CRITICAL: Is the app deployed and accessible?** Judges visit live deployments March 23–25
  - Railway deployment URL needed
  - GitHub Actions CI/CD workflow missing (`.github/workflows/` is empty)
  - Need to verify Railway is serving the app
- [ ] **Is the repo public?** Hackathon requires open source — `github.com/kon-rad/AgentNetwork` needs to be public
- [ ] **Supabase is running** — confirmed (ghkmhcptwaoibpnjzqea.supabase.co)

### Registration

- [ ] **Register on Devfolio** at `synthesis-md.devfolio.co` (deadline: TODAY March 23)
- [ ] **Register on Synthesis** at `synthesis.md` — check if skill.md registration is separate
- [ ] **Team members** listed (1–4 allowed)

### Submission Materials

- [ ] **Demo video** — DEMO-04 not recorded yet. 2-minute video showing autonomous agent loop with on-chain transactions
- [ ] **README** — Does the repo README explain the project clearly for judges?
- [ ] **Process documentation** — `conversationLog` field for human-agent collaboration documentation
- [ ] **On-chain artifacts** — List all deployed contract addresses, tx hashes, Filecoin CIDs

### Per-Bounty Submissions

You can submit to **main track + up to 10 partner bounties simultaneously**.

**Submit to these bounties:**
1. Open Track (automatic)
2. Protocol Labs — "Let the Agent Cook"
3. Protocol Labs — "Agents With Receipts"
4. Base — "Agent Services on Base"
5. Filecoin — "Agentic Storage"
6. SuperRare Partner Track
7. ENS Identity
8. Self Protocol — "Best Self Agent ID Integration"

### Known Bugs to Fix Before Judging

| Bug | File | Severity | Fix |
|-----|------|----------|-----|
| Demo dashboard response parsing | `src/components/demo/demo-dashboard.tsx:159` | HIGH | Parse `body.results` instead of raw body |
| ERC8004Status token ID display | `src/components/profile/erc8004-status.tsx:30` | LOW | Read `data.agentId` instead of `data.tokenId` |

---

## Immediate Action Items (Priority Order)

1. **Verify deployment is live** — judges start today. If not deployed, this is a showstopper
2. **Make repo public** if not already
3. **Register on Devfolio** — deadline is today
4. **Fix demo-dashboard response parsing bug** — judges may trigger the autonomous demo
5. **Record 2-minute demo video** — required for Protocol Labs bounty
6. **Compile on-chain artifact list** — contract addresses, tx hashes, CIDs for all chains
7. **Submit to all 8 bounty tracks** listed above
8. **Ensure agent skill.md is accessible** at `{deployed_url}/skill.md` — this is how agentic judges discover the project

---

## Sources

- Synthesis hackathon: https://synthesis.md/
- Devfolio: https://synthesis-md.devfolio.co/
- GitHub: https://github.com/sodofi/synthesis-hackathon (bounties list)
- Project repo: https://github.com/kon-rad/AgentNetwork
- Phase verifications: `.planning/phases/0{2-8}/*-VERIFICATION.md`
