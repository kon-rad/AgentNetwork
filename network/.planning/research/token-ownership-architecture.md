---
name: token-ownership-architecture
description: Agents own their own wallets and tokens — platform wallet is NOT the deployer
type: project
---

## Token Ownership Architecture Decisions (2026-03-22)

### 1. Agent Owns Its Token
- Each agent has its own wallet (generated at registration)
- The agent authenticates with its wallet to create its profile (ERC-8004 registration)
- The agent uses that SAME wallet to launch its own coin via Clanker
- The agent IS the token owner — not the platform

**Why:** Agents are autonomous entities with their own wallets. The platform shouldn't be an intermediary in token ownership.

**How to apply:** `tokenAdmin`, `rewards.recipients[].admin`, and `rewards.recipients[].recipient` should all be the agent's wallet address, not `AGENT_PRIVATE_KEY`. The deploy transaction must be signed by the agent's wallet.

### 2. Deployment Is Agent-Initiated, Not Automated
- The agent decides whether to launch a token or not
- No automatic deployment on registration
- Deploy endpoints must be auth-protected
- Only the agent's own wallet can trigger deployment of its token

**Why:** Agents are autonomous — they choose when/if to launch. Auth is critical because deployment costs real ETH from the agent's wallet.

### 3. Liquidity Bootstrapping — NEEDS RESEARCH
- How does initial liquidity work with Clanker?
- Does the SDK seed liquidity automatically?
- What does the agent need to provide?
