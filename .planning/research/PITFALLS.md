# Pitfalls Research

**Domain:** AI Agent Marketplace + Web3 Social (on-chain identity, token economics, decentralized storage, ZK identity)
**Researched:** 2026-03-20
**Confidence:** MEDIUM — critical library pitfalls are HIGH confidence (official docs, wagmi guide); newer protocols (ERC-8004, Synapse SDK, Self Protocol) are MEDIUM (early-stage, limited post-mortems)

---

## Critical Pitfalls

### Pitfall 1: Wagmi/RainbowKit Hydration Mismatch Kills the App on Load

**What goes wrong:**
Next.js renders the wallet connection state server-side (disconnected) and the client hydrates with different state (connected), causing a React hydration error. The UI flashes, wallet state disappears on page reload, and in severe cases React throws a hard error that prevents render.

**Why it happens:**
`WagmiProvider`, `RainbowKitProvider`, and `QueryClientProvider` use browser APIs (`localStorage`, `window.ethereum`). They must be Client Components, but the wallet state they hold needs to survive SSR. Without `ssr: true` and cookie-based storage, the server renders "disconnected" and the client disagrees.

**How to avoid:**
1. Set `ssr: true` in `createConfig()`
2. Use `cookieStorage` as the storage adapter
3. In `layout.tsx`, extract cookies server-side via `headers()` and pass to `cookieToInitialState()`
4. Wrap the providers in a `"use client"` component that is NOT the root layout
5. Never put `WagmiProvider` in a Server Component

**Warning signs:**
- Console shows "Hydration failed because the initial UI does not match"
- Wallet connect button flickers on load
- Address disappears after hard refresh despite being connected

**Phase to address:** Wallet Integration phase — get the provider setup right before building anything on top of it

---

### Pitfall 2: x402 Middleware Charges Users for Server Errors

**What goes wrong:**
Using `paymentMiddleware` to protect API routes (rather than `withX402` route wrapper) charges users even when the server returns a 4xx or 5xx error — users pay for failures.

**Why it happens:**
`paymentMiddleware` intercepts at the middleware layer, before route execution. Payment is settled on the incoming request. `withX402` is a route-level wrapper that only settles payment after a successful response (status < 400).

**How to avoid:**
Use `withX402` to wrap individual route handlers, not blanket `paymentMiddleware` for payment-protected routes. Reserve `paymentMiddleware` only for purely static resources where failure is impossible.

```typescript
// WRONG — charges on errors
export const config = { matcher: ["/api/agent-service/:path*"] }

// RIGHT — only charges on success
export const GET = withX402(handler, "0xYourAddress", {
  price: "$0.01",
  network: "base-sepolia"
})
```

**Warning signs:**
- Users report being charged without receiving results
- Test harness shows payment settling on 500 errors during development

**Phase to address:** x402 Payment Integration phase

---

### Pitfall 3: Next.js 16 Breaks x402 Middleware Setup

**What goes wrong:**
x402 middleware config written for Next.js 14/15 (`middleware.ts` with named exports) silently fails or throws on Next.js 16 which replaced it with `proxy.ts` using default exports.

**Why it happens:**
Next.js 16 changed the middleware file from `middleware.ts` (named export `export const middleware = ...`) to `proxy.ts` (default export `export default ...`). The `@x402/next` package lists `next@^15` as a peer dependency but works with Next.js 16 when using the new `proxy.ts` structure.

**How to avoid:**
- Create `proxy.ts` at project root instead of `middleware.ts`
- Use `export default` for the middleware config
- Install with `--legacy-peer-deps` flag: `npm install @x402/next --legacy-peer-deps`

**Warning signs:**
- Payment middleware never fires
- Routes that should return 402 return 200 without a signature

**Phase to address:** x402 Payment Integration phase — verify early with a test route before building the full payment flow

---

### Pitfall 4: Clanker Token Deployment Rate-Limited to 1 Per Wallet Per 24 Hours

**What goes wrong:**
During a hackathon demo loop (deploy → test → redeploy), developers exhaust the per-wallet deploy limit and cannot deploy new tokens for the rest of the demo day.

**Why it happens:**
Clanker enforces a hard rate limit of 1 deployment per wallet address per 24-hour window. The SDK does not clearly surface this limit until the deploy call fails.

**How to avoid:**
- Deploy all demo tokens early (day 1), before integration work begins
- Use multiple wallet addresses for testing different agents — one wallet per agent type
- Record deployed token addresses immediately in a config file so you never need to redeploy
- The SDK has a `canDeploy` check — call it before attempting deployment to confirm availability

**Warning signs:**
- `deployToken` call returns an error around a "rate limit" or "already deployed"
- Second deploy attempt on the same wallet on the same day fails

**Phase to address:** Token Launch (Clanker) phase — deploy all agent tokens in a single session, document addresses

---

### Pitfall 5: Self Protocol Config Mismatch Causes Silent Verification Failure

**What goes wrong:**
ZK proofs submitted by the user pass cryptographically but are rejected by the smart contract because the frontend disclosure config does not exactly match the on-chain verification config registered with the Identity Verification Hub. Users see an error but it appears as a generic transaction revert.

**Why it happens:**
Self Protocol requires the frontend `disclosureConfig` to exactly mirror what was registered via `SelfUtils.formatVerificationConfigV2()` on-chain. Developers often set up the frontend first and the contract second, or redeploy the contract (which changes the scope because scope is derived from `contractAddress + scopeSeed`).

**How to avoid:**
1. Register the on-chain verification config FIRST, get the `configId`
2. Build the frontend disclosure config to match exactly
3. Never redeploy the verifier contract without updating the frontend scope
4. Country allow/block lists must not exceed 40 entries (SDK throws on > 40)
5. Celo Sepolia requires Foundry 0.3.0+ — verify toolchain version before writing contracts

**Warning signs:**
- Transaction reverts with no readable error
- QR code scan succeeds but smart contract call fails
- `scope` mismatch warnings in Self SDK console output

**Phase to address:** Self Protocol ZK Identity phase — lock the contract address and scope before building frontend UI

---

### Pitfall 6: ENS Resolution on Wrong Chain Returns Null

**What goes wrong:**
App connects to Base or Base Sepolia, then calls `useEnsName` or `useEnsAddress` — returns `null` or empty for every address because the query hits the wrong chain.

**Why it happens:**
ENS resolution must always query Ethereum Mainnet (chain ID 1), even when the user's wallet is connected to Base. Wagmi's `useEnsName` hooks work correctly when you specify `chainId: 1`, but if you let it default to the user's connected chain, it will query Base (which has no ENS registry) and return null.

**How to avoid:**
- Always pass `chainId: 1` explicitly to `useEnsName`, `useEnsAddress`, `useEnsAvatar`
- Normalize ENS names with Viem's `normalize()` before resolving
- Handle `null` gracefully — not every address has reverse resolution set; show truncated hex as fallback
- Do not assume `.eth` is the only TLD — ENS supports many dot-separated names

**Warning signs:**
- All ENS queries return `null` even for known `.eth` addresses
- No errors, just empty data

**Phase to address:** ENS Integration phase — test with a known `.eth` address (vitalik.eth) before building the replace-hex-addresses feature

---

### Pitfall 7: ERC-8004 Identity Registry Is an NFT — Don't Register the Same Agent Twice

**What goes wrong:**
Developer registers an agent identity, forgets the token ID, and registers again — creating duplicate NFTs for the same agent. The second registration does not replace the first; both exist on-chain. The UI shows inconsistent identity data.

**Why it happens:**
The ERC-8004 IdentityRegistry stores agents as ERC-721 NFTs (ERC721URIStorage). There is no "update existing registration" flow — each `register` call mints a new NFT. The SDK does not warn if an agent's public key or address is already registered.

**How to avoid:**
- Check if an agent is already registered before calling `register()` — query the registry first
- Store the returned `tokenId` persistently in your DB when registering
- Build an idempotent registration helper: check → skip if found → register if not
- Register all agents once during a setup/seed phase, not on every app restart

**Warning signs:**
- Multiple NFT token IDs returned for the same agent wallet address
- `agent.json` manifest references a different token ID than the registry shows

**Phase to address:** ERC-8004 Agent Identity phase — write the registration logic as an idempotent operation from the start

---

### Pitfall 8: Webpack 5 Doesn't Polyfill Node.js Modules — Breaks Crypto/Buffer in Browser

**What goes wrong:**
Adding wagmi, viem, ethers, `@filoz/synapse-sdk`, or other Web3 libraries to a Next.js app causes build-time or runtime errors like:
- `Module not found: Can't resolve 'crypto'`
- `Buffer is not defined`
- `process is not defined`

**Why it happens:**
Webpack 5 (used by Next.js 13+) removed automatic Node.js core module polyfills. Many Web3 libraries were written assuming Node.js builtins are available in the browser. Viem handles this for its own code, but some dependencies still rely on raw `crypto`, `buffer`, or `stream`.

**How to avoid:**
Add to `next.config.js`:
```javascript
webpack: (config) => {
  config.resolve.fallback = {
    crypto: require.resolve("crypto-browserify"),
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer"),
    process: require.resolve("process/browser"),
  };
  return config;
}
```
Install: `npm install crypto-browserify stream-browserify buffer process`

Viem + Wagmi are generally webpack-5-safe; the main risk is from `@filoz/synapse-sdk`, older ethers versions, and any SDK that hasn't explicitly handled bundler environments.

**Warning signs:**
- Build fails with "Can't resolve 'crypto'" or similar
- App works in Node.js test but throws in browser

**Phase to address:** Foundation/Setup phase — add webpack fallbacks BEFORE adding any Web3 SDK

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode chain IDs (e.g., `8453`) instead of using config constants | Faster initial coding | Breaks when switching between mainnet and testnet for demo | Never — use constants from day 1 |
| Skip null checks on ENS/wallet queries | Less code | Runtime crashes on any user without ENS or on non-Ethereum chains | Never in displayed UI |
| Store wallet addresses in localStorage (not DB) | Zero backend work | Lost on clear, inconsistent with agent profiles | Hackathon-only, never production |
| Single wallet for all agent token deployments | Simpler setup | Hit Clanker 1/24h rate limit with 5+ agents | Never — use one wallet per agent |
| Use `@x402/next` `paymentMiddleware` for all routes | One-line setup | Users charged for server errors | Never for payment-critical routes |
| Skip `ssr: true` in wagmi config | Works in dev | Hydration errors in production SSR | Never |
| Call ERC-8004 `register()` without checking first | Faster code | Duplicate agent NFTs on every app start | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| RainbowKit + Next.js App Router | Put providers in Server Component | Wrap in `"use client"` provider component, pass `initialState` from `headers()` |
| WalletConnect | Forget `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` env var | Register at cloud.walletconnect.com, add to `.env.local` before any testing |
| Clanker SDK | Deploy multiple tokens per wallet in one session | One wallet per agent, deploy all at once, store token addresses in config |
| x402 + Next.js 16 | Use `middleware.ts` with named export | Use `proxy.ts` with default export |
| ENS + Wagmi | Let `useEnsName` default to connected chain | Always pass `chainId: 1` for all ENS operations |
| Self Protocol | Build frontend QR before registering on-chain config | Register contract config first, derive frontend config from resulting `configId` |
| Filecoin Synapse SDK | Forget ethers v6 peer dependency | Install `ethers@6` explicitly; SDK will fail silently or with confusing errors if wrong version |
| ERC-8004 + Base Sepolia | Register agents repeatedly on app boot | Check registry before registering; store `tokenId` in DB after first registration |
| Webpack 5 + Web3 SDKs | Add SDKs then debug cryptic build errors | Add polyfill config to `next.config.js` before adding any Web3 library |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling `useEnsName` for every address in an agent list without caching | Page renders slowly, waterfalls of RPC calls | Batch with `useEnsNames` or cache results; use React Query's `staleTime` | Any list with > 10 agents |
| Polling for on-chain tx confirmation in component render loop | UI hangs, RPC rate limits hit | Use wagmi's `useWaitForTransactionReceipt` hook which handles polling internally | Immediate |
| Loading `@selfxyz/qrcode` server-side | Build error or SSR crash (QR lib uses canvas APIs) | Dynamic import with `ssr: false` | Immediately on SSR |
| Fetching Filecoin content CID on every page render | Slow page loads, FOC costs accumulate | Cache CID → content mapping in SQLite; only fetch new content | Hackathon demo with live agents posting |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing `CDP_API_KEY_SECRET` in client-side code | Full Coinbase API access compromised | Only use in server-side API routes, never in `NEXT_PUBLIC_*` env vars |
| Not validating `x402` payment amounts on the server | Attacker sends $0.000001 payment to unlock $1 service | Always verify price server-side in the `withX402` config, do not trust client-supplied amounts |
| Trusting ERC-8004 agent capabilities without on-chain verification | Agents claim capabilities they don't have | Only trust capabilities that are on-chain or backed by a Validation Registry entry |
| Storing private keys in env vars accessible to frontend | Key theft | Private keys for agents should only live in server-side environment, never `NEXT_PUBLIC_*` |
| Self Protocol QR code reuse | Same proof replayed by different user | Self's nullifier system prevents replay — but only if you implement scope correctly (contract address + seed) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw 0x addresses when ENS resolution is pending | Page looks broken, unprofessional for judges | Show skeleton/truncated address during resolution; swap in ENS name when loaded |
| No feedback during on-chain transactions (ERC-8004 register, Clanker deploy) | User thinks app is frozen | Use wagmi's `useWaitForTransactionReceipt` to show "pending..." state with tx hash |
| Requiring wallet connection to browse agent directory | Judges can't see the product without MetaMask | Make browsing public; only gate write actions (follow, hire, mint) behind wallet connect |
| Self Protocol QR modal with no instructions | Confused users who don't have the Self mobile app | Add a brief explainer: "Download the Self app, scan to verify your identity" |
| Wallet prompt on every page load due to missing cookie storage | Annoying reconnection loop | `cookieStorage` in wagmi config persists session across page loads |

---

## "Looks Done But Isn't" Checklist

- [ ] **Wallet Connection:** RainbowKit renders — but verify actual Base Sepolia chain is active (not Ethereum mainnet) before any on-chain writes
- [ ] **ENS Display:** Names render for test addresses — but verify the `chainId: 1` override is set and null fallback shows hex for non-ENS addresses
- [ ] **Clanker Token:** Deploy tx sent — but verify the resulting ERC-20 contract address is recorded and linked to the agent profile
- [ ] **ERC-8004 Registration:** `register()` called — but verify `tokenId` is stored and the `agent.json` manifest references the correct token ID
- [ ] **x402 Payment:** Route returns 200 to paying clients — but verify a request WITHOUT a payment header correctly returns 402 (not 200)
- [ ] **Self Protocol Verification:** QR scan succeeds on mobile — but verify the on-chain `customVerificationHook()` fired and marked the operator as verified
- [ ] **Filecoin Storage:** Upload returns a CID — but verify the CID is retrievable after a few minutes (not just uploaded but not yet available)
- [ ] **Autonomous Agent Loop:** Agent executes a task — but verify the `agent_log.json` is written and uploaded to Filecoin (required for Protocol Labs bounty)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hydration mismatch in production | MEDIUM | Add `ssr: true` + cookieStorage, redeploy — 30-60 min fix |
| Clanker rate limit exhausted | HIGH (wait or pivot) | Wait 24h, or use a fresh wallet; if demo is today, use pre-recorded video of successful deploy |
| x402 middleware charging on errors | MEDIUM | Swap `paymentMiddleware` for `withX402` wrappers on affected routes |
| Duplicate ERC-8004 registrations | LOW | Query registry for existing tokenId, update local DB to reference the oldest (canonical) one |
| Self Protocol config mismatch | HIGH | Must redeploy verifier contract, update frontend scope, re-test full ZK flow — budget 2-3 hours |
| ENS returning null | LOW | Add `chainId: 1` to the hook call; 5-minute fix |
| Webpack polyfill missing | LOW | Add fallback config; 15-minute fix |
| x402 middleware.ts not firing on Next.js 16 | MEDIUM | Rename to proxy.ts, switch to default export; 30-minute fix |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wagmi/RainbowKit hydration mismatch | Foundation / Wallet Integration | Hard refresh the page — no hydration errors in console |
| x402 charges on errors | x402 Payment Integration | Send request that triggers a 500 — verify no payment settled |
| Next.js 16 breaks x402 middleware | x402 Payment Integration | Hit a protected route with no payment header — must get 402 |
| Clanker rate limit | Token Launch (Clanker) phase | Deploy all agent tokens first thing in this phase |
| Self Protocol config mismatch | Self Protocol / ZK Identity phase | Full round-trip: deploy contract → register config → scan QR → verify on-chain callback fired |
| ENS resolution on wrong chain | ENS Identity phase | Test with `vitalik.eth` — should resolve to address; verify `chainId: 1` in hook |
| ERC-8004 duplicate registration | ERC-8004 Identity phase | Check registry before registering; seed script is idempotent |
| Webpack polyfill missing | Foundation / Setup phase | Build succeeds with all Web3 SDKs installed |
| Self Protocol QR lib SSR crash | Self Protocol phase | `dynamic(() => import('@selfxyz/qrcode'), { ssr: false })` — check build passes |

---

## Sources

- [Wagmi SSR Guide (official)](https://wagmi.sh/react/guides/ssr) — HIGH confidence
- [x402-next npm documentation](https://www.npmjs.com/package/@x402/next) — HIGH confidence
- [x402 with Next.js 16 — proxy.ts pattern](https://dev.to/shahbaz17/using-x402-next-with-nextjs-16-1me1) — MEDIUM confidence
- [Self Protocol Basic Integration (official docs)](https://docs.self.xyz/contract-integration/basic-integration) — HIGH confidence
- [Clanker Changelog](https://clanker.gitbook.io/clanker-documentation/changelog) — HIGH confidence (rate limit, v4 migration)
- [ENS Address Lookup (official docs)](https://docs.ens.domains/web/resolution/) — HIGH confidence
- [wagmi hydration issue tracker](https://github.com/wevm/wagmi/issues/2002) — MEDIUM confidence
- [RainbowKit + Next.js App Router discussion](https://github.com/rainbow-me/rainbowkit/discussions/1315) — MEDIUM confidence
- [ERC-8004 EIP specification](https://eips.ethereum.org/EIPS/eip-8004) — HIGH confidence (NFT-based identity, Sybil attack risk)
- [Webpack 5 polyfill guide (Alchemy)](https://www.alchemy.com/blog/how-to-polyfill-node-core-modules-in-webpack-5) — MEDIUM confidence
- [QuickNode x402 implementation guide](https://www.quicknode.com/guides/infrastructure/how-to-use-x402-payment-required) — MEDIUM confidence
- [Filecoin Onchain Cloud / Synapse SDK docs](https://docs.filecoin.cloud/developer-guides/synapse/) — MEDIUM confidence (new SDK, limited post-mortems)

---
*Pitfalls research for: AI Agent Marketplace + Web3 Social (Network / Synthesis Hackathon)*
*Researched: 2026-03-20*
