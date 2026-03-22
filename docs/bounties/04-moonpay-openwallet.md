# Bounty 04: MoonPay OpenWallet Standard ($3.5K)

**Prize:** $2,500 (1st) + $1,000 (2nd)

## Requirements
- Build on OpenWallet Standard (OWS) — MoonPay's open-source, CC0-licensed wallet infrastructure
- Implement the standard, extend it with chain plugins or policy types, or build agents that use OWS as their wallet layer
- Infrastructure-level: implementations, tooling, integrations

## What OWS Is

OpenWallet Standard (https://openwallet.sh/) is a local-first, chain-agnostic wallet management system:

- **Encrypted vault** at `~/.ows/wallets/` using AES-256-GCM
- **Signing enclave** — isolated subprocess, key material never exposed to LLM context
- **Policy engine** — spending limits, address allowlists, chain restrictions per API key
- **Multi-interface** — MCP server (`ows serve --mcp`), REST API, Node SDK
- **Chain-agnostic** via CAIP-2 identifiers (EVM, Solana, Bitcoin, Cosmos, Tron, TON)

## Evaluation: Should We Use OWS?

### Pros
- Replaces raw private keys in `.env` with encrypted vault
- Policy engine adds guardrails (spending limits per agent)
- Audit trail at `~/.ows/logs/audit.jsonl`
- CC0 license — no restrictions
- Fits the "agent wallet layer" framing perfectly

### Cons
- v0.3.0, 31 GitHub stars — very early stage
- npm package (`@open-wallet-standard/core`) may not be published yet
- Requires a daemon process — incompatible with serverless deployment
- Our current viem-based approach works and is production-grade
- Would require rewriting x402 client, ERC-8004, Clanker, NFT, and USDC modules
- Filecoin chain not listed in OWS supported chains

### Verdict
**High risk for core integration, but viable as a demonstration.** We could create an OWS plugin for Base chain and demonstrate agent wallet creation + signing through OWS, without replacing our entire chain module stack.

## Possible Integration: OWS Base Plugin

Build a minimal OWS chain plugin for Base that demonstrates:
1. Agent creates wallet via OWS (`ows wallet create --chain eip155:8453`)
2. OWS policy limits agent spending to $1/tx
3. Agent signs x402 payments through OWS enclave
4. All signing operations logged to audit trail

This would be a standalone demo within our project, not a full migration.

## Status
Evaluating — needs feasibility check on OWS npm availability and daemon requirements. Lower priority than MoonPay CLI Agents track ($3.5K same prize but CLI track has clearer integration path).
