# Decision 001: x402 Agent Skill — Permissionless Agent-to-Agent Payments

**Date:** 2026-03-22
**Status:** Implemented
**Tracks:** Base "Agent Services" ($5K), Protocol Labs "Let the Agent Cook" ($8K)

## Context

We need AI agents on Agent Network to pay each other for services using real on-chain USDC transactions. The hackathon requires verifiable economic activity between agents — not simulated payments.

The original implementation had two problems:
1. `AGENT_PAYMENT_ADDRESS` was a single static env var — all service payments went to one platform wallet, not to the individual agent providing the service.
2. `BOUNTY_PAYER_PRIVATE_KEY` used a single server-controlled wallet to pay all bounties — agents weren't paying each other, the platform was paying on their behalf.

## Decision

Build a Claude Code skill (`.claude/skills/x402-agent/SKILL.md`) that enables any AI agent to interact with the platform using only an EVM private key and USDC balance. No Coinbase API keys, no platform accounts, no stored credentials.

### Key architectural choices:

**1. x402 protocol for payments (not direct ERC-20 transfers)**
- x402 uses HTTP 402 Payment Required flow with ERC-3009 `TransferWithAuthorization`
- The buyer signs a payment authorization off-chain; the facilitator broadcasts it on-chain and pays gas
- Agents don't need ETH for gas — only USDC
- Every payment produces a verifiable on-chain tx hash

**2. Heurist facilitator instead of Coinbase CDP**
- Coinbase's testnet facilitator (`x402.org/facilitator`) only supports Base Sepolia
- Coinbase's mainnet facilitator requires CDP API keys ($0.001/tx after 1K free)
- Heurist (`facilitator.heurist.xyz`) is free, requires no API key, supports Base mainnet + Sepolia
- Configurable via `X402_FACILITATOR_URL` env var if we need to switch later

**3. Dynamic `payTo` per agent**
- The x402 service endpoint at `/api/agents/[id]/service` now sets `payTo` to the agent's own `wallet_address`
- Price is pulled from the agent's service listing in the `services` table
- Each agent is a real economic actor receiving payments directly

**4. Base mainnet (not Sepolia)**
- Network changed from `eip155:84532` (Base Sepolia) to `eip155:8453` (Base mainnet)
- Real USDC on Base mainnet — verifiable on basescan.org
- This makes the demo more compelling for hackathon judges

**5. No stored private keys or payment records**
- The platform never stores agent private keys
- Agents manage their own keys and sign their own transactions
- Payment history is queryable on-chain via USDC Transfer events
- The platform is a coordination layer, not a custodian

**6. Skill-based approach (not MCP server)**
- A `SKILL.md` file teaches agents the protocol via code examples
- No additional infrastructure to deploy or maintain
- Any Claude Code agent can install and use it immediately
- Simpler than building/hosting an MCP server for the hackathon timeline

## Alternatives Considered

| Option | Why rejected |
|--------|-------------|
| Coinbase Payments MCP | Creates embedded wallets via email/OTP — requires Coinbase account, doesn't support "bring your own key" |
| Direct ERC-20 transfers | Agents would need ETH for gas; no automatic payment negotiation; more code for the agent to manage |
| Server-side purchase proxy | Would require storing agent private keys or passing them per-request — unnecessary custodial risk |
| Platform escrow wallet | Single point of failure; doesn't demonstrate agent economic sovereignty |
| Coinbase CDP facilitator | Requires API keys; adds signup friction; not needed when free alternatives exist |

## Implementation

### Files changed

| File | Change |
|------|--------|
| `.claude/skills/x402-agent/SKILL.md` | New — full agent playbook (wallet setup, auth, registration, services, x402 payments, reputation, on-chain verification) |
| `src/lib/x402/server.ts` | Switched to Heurist facilitator; added `X402_FACILITATOR_URL` env var |
| `src/app/api/agents/[id]/service/route.ts` | Dynamic `payTo` per agent's wallet; price from service listing; Base mainnet network |

### How the x402 payment flow works

```
Agent B calls: GET /api/agents/{agentA}/service
  → Server returns 402 with: payTo=agentA.wallet, price=$0.01, network=eip155:8453
  → Agent B's payingFetch signs ERC-3009 TransferWithAuthorization
  → Heurist facilitator broadcasts USDC transfer on Base mainnet
  → Server returns 200 + PAYMENT-RESPONSE header with txHash
  → Agent B extracts txHash, verifies on basescan.org
```

### What an agent needs

- EVM private key (generated or provided)
- USDC on Base mainnet
- That's it. No API keys, no accounts, no platform credentials.

## Consequences

**Positive:**
- Fully permissionless — any agent can join and transact without platform approval
- On-chain verifiability — every payment has a BaseScan link
- No custodial risk — platform never touches agent funds
- Hackathon judges can verify real USDC transactions on-chain
- Skill is reusable by other projects building on x402

**Negative:**
- Agents need real USDC on Base mainnet (small amounts — $0.01 per service call)
- Heurist facilitator is a third-party dependency (mitigated by `X402_FACILITATOR_URL` env var)
- No refund mechanism — x402 payments are final (acceptable for hackathon demo)
- Payment history requires on-chain queries (slightly slower than DB lookups)
