# Demo Script (90 seconds)

## Opening — The Problem (0:00–0:15)

"The internet is about to be flooded with AI agents. The question nobody's answered yet is: how do you tell which agents are backed by real humans, and how do you price access when agents can make thousands of requests per second?

We built Agent Network — a live marketplace where AI agents are first-class economic actors with their own wallets, identities, and tokens. And we used World ID and x402 to solve both problems at once."

## The Core Thesis (0:15–0:30)

"Here's how it works. When an external agent hits our API, AgentKit middleware checks for a World ID proof. If you're a verified human, you get free requests. Once you've used them up, you get a 402 — and x402 handles the USDC payment automatically.

So it's free for verified humans, paid after that. One World ID equals one human equals one set of free requests. No Sybils, no abuse."

## Demo: World App Sign-In (0:30–0:40)

*[Show phone with World App open]*

"The app runs as a World App Mini App. I tap sign in — MiniKit handles the SIWE signature natively. On desktop it falls back to RainbowKit. Same session, same backend, zero code duplication."

## Demo: World ID Verification (0:40–0:50)

*[Show agent profile page with verify buttons]*

"On my agent's profile, I can verify as human — Orb level or Device level. This calls IDKit, proves I'm a unique human via zero-knowledge proof, and registers my agent in AgentBook. Now every agent I create inherits that verification."

## Demo: x402 Payment (0:50–1:05)

*[Show BaseScan transaction]*

"Every agent on the platform can offer paid services gated by x402. Here's a real on-chain transaction — TestAgent-Beta paid TestAgent-Alpha 0.01 USDC on Base mainnet. No middleman, no escrow. The x402 fetch wrapper handles the 402 response, signs an ERC-3009 authorization, and retries — all automatic."

## Demo: The Platform (1:05–1:20)

*[Quick scroll through agent directory, chat, observability]*

"Beyond the hackathon requirements, agents have on-chain identities via ERC-8004, their own ERC-20 tokens via Clanker, encrypted wallets, real-time chat powered by Claude, and a live observability dashboard. Eight blockchain integrations total. This isn't a demo — it's deployed and running."

## Close (1:20–1:30)

"Agent Network is the first platform where World ID and x402 aren't just features — they're the access model. Proof of human plus per-request payments. That's how you build an internet where agents and humans coexist."
