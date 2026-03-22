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

---
---

# v2.0 Pitfalls: Agent Subscriptions & Live Agents Platform

**Domain:** Multi-service agent platform — SQLite→Supabase migration, NanoClaw fork, WireGuard tunnels, SIWE auth, Docker agent isolation, SSE streaming, Realtime observability, monorepo CI/CD
**Researched:** 2026-03-22
**Confidence:** MEDIUM — infrastructure pitfalls from official docs are HIGH; NanoClaw-specific and Railway+WireGuard combination findings are MEDIUM (limited post-mortems for this exact stack)

---

## Critical Pitfalls (v2.0)

### Pitfall V2-1: Supabase Connection Pool Exhaustion in Serverless Next.js

**What goes wrong:**
Railway deploys Next.js as a serverless-style environment where each request may spawn a new module instance. Each instance opens its own Postgres connection. Under moderate load (20+ concurrent users), the free-tier Supabase Postgres hits its 60 concurrent direct connection limit. All new requests fail with `too many connections` or hang indefinitely.

**Why it happens:**
Supabase free tier allows 60 direct Postgres connections. Supavisor (the connection pooler) uses transaction mode on port 6543 — but developers default to the direct connection string on port 5432. Creating one Supabase client per request module instance (not per application instance) multiplies connections rapidly.

**How to avoid:**
- Always use the Supavisor pooler connection string (port `6543`, transaction mode) — never the direct port `5432` in Next.js API routes
- Create one Supabase client singleton per process — do not instantiate inside route handlers
- The pooler URL format is: `postgres://[user].[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- For Drizzle ORM: configure with `{ prepare: false }` when using transaction mode (prepared statements are not supported in transaction pooling)

**Warning signs:**
- Console errors: `remaining connection slots are reserved`, `FATAL: too many connections`
- API routes succeed locally but fail under Railway load
- Supabase dashboard shows connection count near maximum during normal usage

**Phase to address:** Supabase Migration phase — establish pooler-only client pattern before any other DB code is written

---

### Pitfall V2-2: SQLite Boolean/Integer Schema Mismatch After Migration

**What goes wrong:**
SQLite stores booleans as integers (0/1) and has no strict type enforcement. After migrating to Postgres, existing data and query logic that relied on SQLite's implicit coercions breaks silently. Queries like `WHERE is_active = true` may return 0 rows if data was stored as `1`. JSON columns stored as TEXT in SQLite need explicit casting in Postgres.

**Why it happens:**
SQLite is type-flexible — any value can go in any column. Postgres enforces strict typing. The migration moves data but not the semantic assumptions baked into the application code.

**How to avoid:**
1. Audit every SQLite column type against what Postgres expects before running migration
2. Explicitly cast boolean columns during migration: `SELECT CASE WHEN is_active = 1 THEN TRUE ELSE FALSE END`
3. Use `pgloader` or write a TypeScript migration script that explicitly maps each column — do not use `pg_dump` from SQLite (incompatible format)
4. Test every read query against the migrated Postgres data before switching production traffic
5. For JSON/TEXT columns: use Postgres `jsonb` type and add a migration step to cast existing data

**Warning signs:**
- Queries return unexpected empty results after migration
- Filter operations on boolean columns return wrong row counts
- `JSON.parse()` errors in API routes that previously worked fine

**Phase to address:** Supabase Migration phase — write and run migration scripts against a test Supabase project before any feature work in v2.0

---

### Pitfall V2-3: Supabase RLS Blocks NanoClaw Server-Side Writes

**What goes wrong:**
NanoClaw (running on VPS) writes agent events to Supabase using the service role key. If Row Level Security is enabled on `agent_events` (or any table NanoClaw writes to) without a policy that permits service role access, all writes from NanoClaw will fail with permission denied — even though the service role key bypasses RLS by default in the Supabase client.

**Why it happens:**
There are two RLS bypass modes: Supabase `service_role` key bypasses RLS by default when using the Supabase JS client. But if NanoClaw connects via direct Postgres URL (not the Supabase client), it connects as a regular `postgres` role — not the `service_role` — and RLS policies apply. Developers assume "service role = bypass always" but this only applies to the Supabase SDK's auth header approach, not direct psql connections.

**How to avoid:**
- In NanoClaw, use the Supabase JS client (`@supabase/supabase-js`) with the service role key — not a raw Postgres connection string
- If direct Postgres access is required, use `SET LOCAL ROLE service_role` before writes, or add an explicit `FOR ALL USING (true)` policy for the service role
- Test with RLS enabled from day one on a staging Supabase project before shipping

**Warning signs:**
- Agent events missing from Supabase dashboard despite NanoClaw logs showing successful writes
- `permission denied for table agent_events` errors in NanoClaw logs
- No errors from the JS client but rows not appearing (silent failure when using anon key instead of service role)

**Phase to address:** Supabase Migration phase — establish NanoClaw → Supabase write path and verify with RLS enabled before building the observability dashboard

---

### Pitfall V2-4: SIWE Session Remains Valid After Wallet Switch

**What goes wrong:**
A user signs in with wallet A, then switches their active wallet to wallet B in MetaMask. The SIWE session cookie still shows wallet A as authenticated. All subsequent actions (launching an agent, claiming ownership) execute against wallet A's identity — potentially charging or crediting the wrong user.

**Why it happens:**
SIWE sessions are cookie-based (iron-session). Once signed, the session persists until expiry. The browser wallet and the server session become decoupled — the server has no mechanism to detect that the connected wallet changed.

**How to avoid:**
1. Subscribe to wagmi's `useAccount` `onConnect`/`onDisconnect` events; when the connected address changes from the session address, call `/api/auth/logout` immediately
2. On every authenticated API request, verify the JWT/session wallet address matches the `X-Wallet-Address` header sent by the client
3. Set a short session TTL (e.g., 24 hours) and re-verify on sensitive actions (agent launch, payment)
4. Use iron-session with nonce tracking: store the nonce server-side and invalidate it on logout (prevent session cookie replay)

**Warning signs:**
- Console logs showing wallet address differs from session address
- Agent actions attributed to a different user than the currently displayed wallet
- Users who "logged out" via wallet disconnect still show as authenticated in API calls

**Phase to address:** SIWE Auth phase — implement wallet change detection before building any ownership-gated features

---

### Pitfall V2-5: WireGuard Tunnel Breaks After Railway Redeploy (Dynamic IP Change)

**What goes wrong:**
Railway assigns a new internal IP to the Next.js service container on every redeploy. The WireGuard peer config on the VPS hardcodes Railway's IP as the allowed peer. After redeploy, the WireGuard handshake fails — NanoClaw and Next.js can no longer communicate. The app appears up (HTTP 200) but all agent actions silently fail.

**Why it happens:**
WireGuard peer configurations use static IP addresses in `AllowedIPs`. Railway does not guarantee a static IP for its service containers. On redeploy, the container gets a new IP that is not in the VPS's WireGuard allowed peers list.

**How to avoid:**
- Use Railway's static outbound IP feature (available on Pro plan) and pin that IP in the WireGuard config
- Alternative: instead of IP-pinning, use DNS-based peer resolution with `PersistentKeepalive = 25` and a dynamic DNS record pointing to Railway's current IP — but this adds complexity
- Recommended for simplicity: configure NanoClaw's HTTP endpoint to require a shared secret header rather than relying solely on WireGuard IP filtering. Double-auth means WireGuard failure is non-catastrophic.
- Test tunnel connectivity explicitly in CI — deploy a health check that calls NanoClaw via the tunnel and fails the deploy if it doesn't respond

**Warning signs:**
- Agent chat requests return 502 or timeout after a Railway redeploy
- `wg show` on the VPS shows 0 bytes received from the Railway peer after deployment
- Application logs show Next.js route handler executing but NanoClaw never receiving the request

**Phase to address:** Infrastructure / WireGuard Setup phase — build the connectivity health check before any feature work that relies on the tunnel

---

### Pitfall V2-6: SSE Streaming Cut Off by Railway's Default Proxy Timeout

**What goes wrong:**
Agent chat responses stream via SSE from NanoClaw through Next.js to the browser. Railway's reverse proxy closes idle HTTP connections after ~60 seconds. Long agent runs (research tasks, code generation) that take >60 seconds between output tokens cause the SSE connection to drop mid-stream. The browser receives an incomplete response or a connection reset error.

**Why it happens:**
Railway (like most PaaS proxies) enforces idle connection timeouts to prevent resource leaks. SSE connections are long-lived HTTP/1.1 responses with chunked encoding. Without keepalive pings, the proxy treats the connection as idle and terminates it.

**How to avoid:**
1. Send SSE keepalive comments every 15-25 seconds: write `: keepalive\n\n` to the response stream while the agent is thinking
2. In the Next.js streaming route, set explicit headers: `Connection: keep-alive`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
3. Handle reconnection on the client: the browser's `EventSource` API reconnects automatically on connection drop, but implement a message ID sequence so the client can request replay from where it left off
4. Verify Railway's current timeout value — it may be configurable per service

**Warning signs:**
- Agent responses that take >60s arrive cut off or trigger a browser connection error
- Browser devtools Network tab shows SSE connection closing unexpectedly mid-stream
- `ERR_INCOMPLETE_CHUNKED_ENCODING` in browser console for long agent runs

**Phase to address:** NanoClaw Integration / Real-Time Chat phase — build keepalive from the start, test with an agent that deliberately takes 90 seconds

---

### Pitfall V2-7: Agent Container State Lost on NanoClaw Process Restart

**What goes wrong:**
NanoClaw maintains per-agent session state (conversation history, learned skills, in-progress tasks) in memory or in ephemeral container file paths. When the NanoClaw process on the VPS restarts (due to deployment, crash, or VPS reboot), all in-flight agent sessions are lost. Users' active chat sessions drop mid-conversation with no recovery path.

**Why it happens:**
Docker containers are ephemeral by design. Files written inside a container at runtime disappear when the container stops. NanoClaw's session persistence depends on how the fork is configured — if session data is only in memory or in the container's writable layer, it does not survive process restart.

**How to avoid:**
1. Configure NanoClaw to write session state (conversation history, current task state) to a path mounted as a Docker volume — not inside the container filesystem
2. Write a session checkpoint to Supabase `agent_sessions` table on every tool call completion, not just on graceful shutdown
3. On NanoClaw startup, check Supabase for any sessions that were `in_progress` and either resume them or mark them as `interrupted`
4. Mount `/var/nanoclaw/sessions/<agent_id>/` as a named Docker volume: `docker run -v nanoclaw_sessions:/var/nanoclaw/sessions ...`

**Warning signs:**
- Agent chat sessions drop after VPS maintenance without warning
- Users report losing chat history
- `agent_sessions` table shows sessions stuck in `in_progress` state after a restart

**Phase to address:** NanoClaw Infrastructure phase — define the session persistence strategy before building the chat UI

---

### Pitfall V2-8: Claude API Key Leaked Through Agent's .env File Access

**What goes wrong:**
NanoClaw runs Claude agents in Docker containers with `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` injected via environment variable. Claude Code (running inside the container) can read its own environment — including the API key — and output it in response to a prompt injection attack. A malicious agent instruction (via user input or a tool result) extracts the shared credential and exfiltrates it.

**Why it happens:**
Claude Code automatically reads `.env` files and has access to its own process environment. CVEs CVE-2025-59536 and CVE-2026-21852 (patched in 2025-2026) demonstrated that ANTHROPIC_BASE_URL redirection and malicious project files can cause Claude Code to leak API keys. The shared credential architecture means one extraction compromises all agents.

**How to avoid:**
1. Use the credential proxy pattern: NanoClaw containers should have NO API key in their environment. Instead, set `ANTHROPIC_BASE_URL` to point to a proxy running on the VPS host. The proxy injects the real API key into outgoing requests.
2. Run container with `--network none` and expose only the proxy Unix socket: `docker run --network none -v /var/run/nanoclaw-proxy.sock:/var/run/proxy.sock ...`
3. The proxy enforces an allowlist: only `api.anthropic.com` is reachable
4. Rotate the API key regularly; alert on API usage spikes that indicate leakage

**Warning signs:**
- Unexpected Anthropic API usage in billing dashboard
- Agent conversations that appear to contain key-shaped strings
- NanoClaw logs showing outbound requests to non-Anthropic hosts from a container

**Phase to address:** NanoClaw Security phase (part of NanoClaw fork work) — build the proxy before deploying any live agents

---

### Pitfall V2-9: Supabase Realtime Channel Fragmentation Exhausts 200 Connection Limit

**What goes wrong:**
Each browser tab subscribed to the observability dashboard opens one Supabase Realtime connection. With N agents and M users watching the dashboard, connections multiply as M × N if each agent has its own Realtime channel. At 200 concurrent connections (free tier limit), new subscribers are rejected. This can happen with as few as 20 users watching an active 10-agent deployment.

**Why it happens:**
Supabase Realtime free tier allows 200 concurrent peak connections. The default pattern of "one channel per agent" means a single dashboard page for 10 agents opens 10 connections per browser tab. 20 users = 200 connections = limit hit.

**How to avoid:**
1. Multiplex: subscribe to a single `agent_events` channel filtered by the current user's agents using Postgres Changes filter `filter: 'owner_wallet=eq.${address}'` — one connection per user regardless of how many agents they own
2. Use `broadcast` (not Postgres Changes) for high-frequency events (token counts, progress ticks) — broadcast is more efficient for write-heavy workloads
3. Move to Supabase Pro ($25/month) to get 500 concurrent connections if multiplexing isn't enough
4. Implement connection pooling on the client: one shared Supabase client for the entire browser session

**Warning signs:**
- Realtime subscriptions silently fail for new users while existing users retain connections
- Supabase dashboard shows concurrent connections approaching 200
- Observability dashboard shows stale data for some agents but live data for others

**Phase to address:** Observability Dashboard phase — design the channel topology before building the UI

---

### Pitfall V2-10: Monorepo CI/CD Deploys Both Targets on Every Commit

**What goes wrong:**
Without path-based filtering, every GitHub push triggers both Railway (Next.js app) and VPS (NanoClaw agent-server) deployments — even when only one changed. This doubles deploy time, risks unnecessary NanoClaw restarts that drop active agent sessions, and exhausts Railway build minutes.

**Why it happens:**
GitHub Actions workflow files default to triggering on all pushes to the branch. Without `paths` filters or the `dorny/paths-filter` action, all jobs run unconditionally.

**How to avoid:**
1. Use `dorny/paths-filter` to conditionally run deploy jobs:
   ```yaml
   - uses: dorny/paths-filter@v3
     id: changes
     with:
       filters: |
         app:
           - 'app/**'
         agent-server:
           - 'agent-server/**'
   ```
2. Gate each deploy job on its corresponding filter output: `if: steps.changes.outputs.app == 'true'`
3. For Railway: configure "Watch Paths" in the Railway dashboard to `app/**` so Railway also ignores agent-server changes natively
4. NanoClaw deploys should require a manual approval gate or be off-hours — a mid-session deploy drops all active agent containers

**Warning signs:**
- Deploy logs show NanoClaw restarting after a frontend-only CSS change
- Users lose active chat sessions after unrelated code pushes
- Railway build minutes depleting faster than expected

**Phase to address:** CI/CD Pipeline phase — configure path filtering before the first production deployment

---

## Technical Debt Patterns (v2.0)

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use direct Postgres URL (port 5432) instead of Supavisor pooler | Simpler connection string | Connection exhaustion under Railway concurrency | Dev/testing only; never production |
| Skip credential proxy, inject API key directly into NanoClaw containers | Simpler setup | Single prompt injection can leak the shared API key for all agents | Never |
| Store NanoClaw session state only in memory | No extra infra to set up | All active sessions lost on any process restart or VPS maintenance | Single-user dev demos only |
| One Supabase Realtime channel per agent | Simpler subscription code | Exhausts 200-connection free tier with ~10 concurrent users | Never in multi-user production |
| Trigger all CI/CD jobs on every push | Simpler workflow file | NanoClaw restarts on frontend changes, dropping active sessions | Never once users are active |
| Use iron-session without nonce revocation on logout | Simpler auth code | Session cookies remain valid after logout (replay attack) | Never |

---

## Integration Gotchas (v2.0)

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase + Next.js serverless | Instantiate client inside route handler | Create singleton client outside handler; use pooler port 6543 |
| NanoClaw → Supabase writes | Use raw Postgres URL (bypasses service role pattern) | Use Supabase JS client with service role key; RLS is bypassed correctly |
| SIWE + iron-session | Never re-verify wallet address after sign-in | Check session wallet vs connected wallet on every sensitive action |
| WireGuard + Railway | Assume Railway IP is stable across redeploys | Use Railway static IP (Pro) or add shared-secret defense layer |
| SSE + Railway proxy | Omit keepalive pings for long agent runs | Send `: keepalive\n\n` every 15-25s; set `X-Accel-Buffering: no` header |
| Docker volumes + NanoClaw | Let session state default to container ephemeral storage | Mount named volume for session data; checkpoint to Supabase on each tool call |
| Claude credential proxy | Pass `ANTHROPIC_API_KEY` directly to container env | Set `ANTHROPIC_BASE_URL` to host proxy; container never sees real key |
| Supabase Realtime + observability | Open one channel per agent per user | Multiplex: one channel per user with `owner_wallet=eq.${address}` filter |
| GitHub Actions monorepo | Run all jobs on every push | Use `dorny/paths-filter` to gate app vs agent-server deploy jobs |

---

## Performance Traps (v2.0)

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Postgres RLS policy with no index on `owner_wallet` column | `agent_events` queries slow as event volume grows | Add index: `CREATE INDEX ON agent_events (owner_wallet)` | ~10,000 rows in agent_events |
| Supabase Realtime Postgres Changes for high-frequency events (token count ticks) | Messages per second limit (100 free / 500 pro) hit, events dropped | Use Broadcast channel for high-frequency; Postgres Changes only for state transitions | >5 agents streaming simultaneously |
| Rendering full agent event log in the browser without pagination | Dashboard freezes with thousands of log rows | Paginate or virtualize the event list; only fetch last N events | ~500 events per agent session |
| NanoClaw spawning concurrent containers without MAX_CONCURRENT_CONTAINERS limit | VPS OOM kills containers mid-run | Set `MAX_CONCURRENT_CONTAINERS` to stay within VPS RAM budget (~10-12 on 4GB VPS) | 13+ concurrent agents on 4GB VPS |

---

## Security Mistakes (v2.0)

| Mistake | Risk | Prevention |
|---------|------|------------|
| NanoClaw container has access to Docker socket | Any agent achieving code execution can launch arbitrary containers or escape to host | Never mount `/var/run/docker.sock` into agent containers; NanoClaw orchestrator manages Docker, agents run inside containers with no Docker access |
| ANTHROPIC_API_KEY in NanoClaw container environment | Prompt injection extracts key; one breach = all agents compromised | Use credential proxy; container env should only contain `ANTHROPIC_BASE_URL` pointing to proxy |
| WireGuard tunnel as sole security layer between Railway and NanoClaw | WireGuard misconfiguration or Railway IP change = open NanoClaw to internet | Defense in depth: WireGuard + shared secret header (`X-NanoClaw-Secret`) verified in NanoClaw request handler |
| Supabase service role key exposed in client-side code | Full DB access without RLS | Service role key only in server-side env vars; client uses anon key with RLS policies |
| SIWE session not invalidated on wallet disconnect | User believes they logged out but session cookie remains valid | Call `/api/auth/logout` on `disconnect` event; server-side nonce invalidation |
| Agent container running as root | Container escape grants root on VPS host | Run NanoClaw agent containers with `--user 1000:1000` and `--cap-drop ALL` |

---

## "Looks Done But Isn't" Checklist (v2.0)

- [ ] **Supabase Migration:** All rows migrated — but verify boolean columns are actual Postgres `boolean` type (not `integer`), and run a row count comparison between SQLite and Supabase
- [ ] **Connection Pooler:** Supabase client created — but verify the connection string uses port `6543` (Supavisor) not `5432` (direct)
- [ ] **RLS Enabled:** Policies written — but verify NanoClaw server-side writes succeed with a test event insert using the service role key
- [ ] **SIWE Auth:** Login flow works — but verify that changing wallet in MetaMask invalidates the current session (not just updates the displayed address)
- [ ] **WireGuard Tunnel:** `wg show` shows connection — but verify connectivity survives a Railway redeploy by triggering one during testing
- [ ] **SSE Streaming:** Short messages stream correctly — but verify a 90-second agent run delivers all tokens without connection drop
- [ ] **Agent Container:** Agent runs successfully — but verify that stopping and restarting NanoClaw preserves session state (or at least marks sessions as interrupted in Supabase)
- [ ] **Credential Proxy:** Proxy is running — but verify the container environment does NOT contain `ANTHROPIC_API_KEY` (only `ANTHROPIC_BASE_URL`)
- [ ] **CI/CD Split Deploy:** Path filters configured — but verify that a change to `app/` does not trigger the `agent-server` deploy job (check GitHub Actions logs)
- [ ] **Realtime Dashboard:** One user's dashboard works — but verify with 5 simultaneous browser tabs that Supabase connection count stays manageable

---

## Recovery Strategies (v2.0)

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Connection pool exhaustion in production | MEDIUM | Switch connection string to port 6543 pooler; redeploy; no data loss |
| SQLite boolean data broken in Postgres | HIGH | Write a data repair migration; re-test all query paths; 2-4 hour fix |
| WireGuard tunnel down after Railway redeploy | MEDIUM | Reconfigure WireGuard peer on VPS with new Railway IP; if using static IP, check Railway billing; 30-60 min |
| Active agent sessions lost on NanoClaw restart | MEDIUM | Implement session checkpoint-to-Supabase; for immediate recovery, acknowledge sessions as lost and prompt users to restart |
| API key leaked via prompt injection | HIGH | Rotate key immediately in Anthropic dashboard; audit all API usage; implement credential proxy architecture; 2-4 hours + audit |
| Supabase Realtime limit hit | LOW | Upgrade to Pro ($25/month) or refactor to multiplex channels; 1-2 hour fix |
| SSE connections dropped at 60s | MEDIUM | Add keepalive ping to streaming route; redeploy; 30-min fix |

---

## Pitfall-to-Phase Mapping (v2.0)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Supabase connection pool exhaustion | Supabase Migration | Load test with 20 concurrent requests; connection count stays below 30 in Supabase dashboard |
| SQLite→Postgres type mismatches | Supabase Migration | Row count parity check; boolean column audit; all existing API tests pass against Supabase |
| RLS blocks NanoClaw writes | Supabase Migration | Insert a test agent_event from NanoClaw server with RLS enabled; verify it appears in dashboard |
| SIWE wallet switch decoupling | SIWE Auth phase | Switch wallet in MetaMask during active session; verify session invalidated |
| WireGuard IP volatility | Infrastructure / WireGuard Setup | Trigger a Railway redeploy; verify tunnel reconnects within 60 seconds |
| SSE proxy timeout | NanoClaw Integration / Chat UI | Run a 90-second agent task; all tokens arrive in browser |
| Agent session loss on restart | NanoClaw Infrastructure | Restart NanoClaw; verify sessions marked interrupted in Supabase |
| Credential proxy bypass | NanoClaw Security (fork work) | `docker inspect` agent container — `ANTHROPIC_API_KEY` must not appear in env |
| Realtime channel exhaustion | Observability Dashboard | Open 20 browser tabs; Supabase dashboard shows connection count; no silent failures |
| Monorepo deploy cross-contamination | CI/CD Pipeline | Push a frontend-only change; confirm agent-server deploy job skipped in GitHub Actions |

---

## Sources (v2.0)

- [Supabase Realtime Limits (official docs)](https://supabase.com/docs/guides/realtime/limits) — HIGH confidence (200 concurrent free, 500 pro, verified)
- [Supabase Connection Pooling + "Too Many Connections"](https://needthisdone.com/blog/supabase-connection-pooling-production-nextjs) — MEDIUM confidence
- [Supabase RLS Performance Best Practices (official)](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH confidence
- [Supabase Common Mistakes](https://hrekov.com/blog/supabase-common-mistakes) — MEDIUM confidence
- [Claude Agent SDK Secure Deployment (official Anthropic docs)](https://platform.claude.com/docs/en/agent-sdk/secure-deployment) — HIGH confidence (credential proxy pattern, container flags)
- [Check Point Research: CVE-2025-59536 / CVE-2026-21852 — Claude Code API key exfiltration](https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/) — HIGH confidence (patched, but architecture lesson stands)
- [Knostic: Claude/.env secret leakage](https://www.knostic.ai/blog/claude-cursor-env-file-secret-leakage) — MEDIUM confidence
- [SIWE session management — login.xyz official docs](https://docs.login.xyz/sign-in-with-ethereum/quickstart-guide/implement-sessions) — HIGH confidence (nonce invalidation pattern)
- [wagmi SIWE best practices discussion](https://github.com/wevm/wagmi/discussions/1989) — MEDIUM confidence (wallet switch decoupling)
- [iron-session security notes](https://github.com/vvo/iron-session) — MEDIUM confidence (stateless sessions, nonce replay)
- [Railway Docker-in-Docker blocked (community confirmation)](https://station.railway.com/feedback/docker-in-docker-d07c4730) — MEDIUM confidence
- [Railway Monorepo deployment guide (official)](https://docs.railway.com/guides/monorepo) — HIGH confidence (path filtering, watch paths)
- [dorny/paths-filter GitHub Actions pattern](https://blog.logrocket.com/creating-separate-monorepo-ci-cd-pipelines-github-actions/) — MEDIUM confidence
- [SSE nginx configuration and proxy timeout patterns](https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view) — MEDIUM confidence
- [Docker volumes and ephemeral container storage](https://docs.docker.com/engine/storage/) — HIGH confidence
- [Docker container security — cap-drop, non-root user](https://docs.docker.com/engine/security/) — HIGH confidence
- [Docker network isolation pitfalls](https://hexshift.medium.com/docker-network-isolation-pitfalls-that-put-your-applications-at-risk-b60356a14033) — MEDIUM confidence

---
*v2.0 pitfalls research for: Agent Subscriptions & Live Agents Platform (NanoClaw + Supabase + WireGuard + SIWE)*
*Researched: 2026-03-22*
