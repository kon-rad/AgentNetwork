# Phase 5: x402 Payments - Research

**Researched:** 2026-03-21
**Domain:** x402 payment protocol, USDC on Base, HTTP 402 payment gating
**Confidence:** HIGH

## Summary

x402 is Coinbase's open payment protocol built on the HTTP 402 status code. It enables machine-to-machine payments where a server responds with payment requirements, a client signs an ERC-3009 `TransferWithAuthorization` message, and a facilitator verifies and settles the payment on-chain. The official `@x402/*` monorepo provides packages for Next.js integration (`@x402/next`), client fetch wrapping (`@x402/fetch`), and EVM payment schemes (`@x402/evm`).

This phase has two distinct payment flows: (1) x402 payment gating on agent service API routes (PAY-01, PAY-02), and (2) direct on-chain USDC transfer for bounty completion (PAY-03, PAY-04). The x402 protocol handles the first; viem's `writeContract` with the ERC-20 transfer ABI handles the second.

**Primary recommendation:** Use `@x402/next` with `paymentProxy` in `proxy.ts` for page-level gating, `withX402` for API route-level gating, and `@x402/fetch` with `wrapFetchWithPaymentFromConfig` for the client-side autonomous agent payment wrapper. For bounty payments, use viem directly to call USDC `transfer()` on Base.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-01 | Agent service endpoints wrapped with x402 payment middleware accepting USDC on Base | `@x402/next` withX402 wrapper for API routes + paymentProxy in proxy.ts; ExactEvmScheme for EVM; network `eip155:84532` (Sepolia) or `eip155:8453` (mainnet) |
| PAY-02 | Agent clients use x402 fetch wrapper for autonomous service payments | `@x402/fetch` wrapFetchWithPaymentFromConfig with ExactEvmScheme client; agent private key via privateKeyToAccount from viem |
| PAY-03 | Bounty completion triggers on-chain USDC payment with transaction hash | viem writeContract with ERC-20 transfer ABI; USDC address on Base Sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7e`; store tx_hash in bounties table (column already exists) |
| PAY-04 | Transaction confirmation feedback shown to user (pending/confirmed/failed with BaseScan link) | Bounty detail page already shows tx_hash; enhance with status polling via viem waitForTransactionReceipt + BaseScan link |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @x402/next | latest | Next.js payment proxy + withX402 route wrapper | Official Coinbase x402 Next.js integration |
| @x402/fetch | latest | Client-side fetch wrapper for autonomous payments | Official x402 client SDK, handles 402 response + payment signing |
| @x402/core | latest | Core types, HTTPFacilitatorClient, x402ResourceServer | Required by @x402/next |
| @x402/evm | latest | ExactEvmScheme for EVM payment verification (server) and signing (client) | Official EVM payment scheme |
| viem | ^2.47.5 | On-chain USDC transfer for bounty payments, account management | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @x402/paywall | latest | Payment UI overlay for protected pages | Optional -- only if protecting page routes (not just API routes) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @x402/next | Raw proxy.ts + manual 402 handling | Much more code, lose facilitator integration |
| @x402/fetch | Manual X-PAYMENT header construction | Error-prone, must implement ERC-3009 signing manually |
| Coinbase facilitator | Self-hosted facilitator | Unnecessary complexity for hackathon; free tier is 1000 tx/month |

**Installation:**
```bash
pnpm install @x402/next @x402/core @x402/fetch @x402/evm
```

Note: May need `--legacy-peer-deps` or pnpm equivalent if peer dependency issues arise.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── proxy.ts                           # x402 paymentProxy (Next.js 16 convention)
├── lib/
│   ├── chain/
│   │   └── usdc.ts                    # USDC transfer helper (viem writeContract)
│   └── x402/
│       ├── server.ts                  # x402ResourceServer + ExactEvmScheme setup
│       └── client.ts                  # wrapFetchWithPaymentFromConfig setup
├── app/
│   ├── api/
│   │   ├── agents/[id]/service/       # x402-gated agent service endpoint
│   │   │   └── route.ts              # Uses withX402 wrapper
│   │   └── bounties/[id]/
│   │       ├── complete/route.ts      # Enhanced: triggers USDC transfer
│   │       └── pay/route.ts           # New: initiates bounty USDC payment
│   └── bounties/[id]/
│       └── page.tsx                   # Enhanced: tx status + BaseScan link
```

### Pattern 1: proxy.ts with paymentProxy (Page-Level Gating)
**What:** Next.js 16 renamed middleware.ts to proxy.ts. The `@x402/next` package provides `paymentProxy` which returns a function compatible with the proxy convention.
**When to use:** Protecting page routes (HTML responses)
**Example:**
```typescript
// src/proxy.ts
import { paymentProxy } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});
const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

export const proxy = paymentProxy(
  {
    "/agents/[id]/service": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.01",
          network: "eip155:84532", // Base Sepolia
          payTo: process.env.AGENT_PAYMENT_ADDRESS!,
        },
      ],
      description: "Agent service access",
      mimeType: "application/json",
    },
  },
  server,
);

export const config = {
  matcher: ["/agents/:id/service/:path*"],
};
```

### Pattern 2: withX402 for API Route Handlers
**What:** Wraps individual route handlers with payment requirement. Payment is settled AFTER successful response (status < 400), preventing charging for failed requests.
**When to use:** Protecting API routes (JSON responses)
**Example:**
```typescript
// src/app/api/agents/[id]/service/route.ts
import { withX402 } from "@x402/next";
import { server } from "@/lib/x402/server";

async function handler(req: Request) {
  // Agent service logic
  return Response.json({ result: "..." });
}

export const GET = withX402(
  handler,
  {
    accepts: [
      {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:84532",
        payTo: "0x...", // Agent's wallet address
      },
    ],
    description: "Agent service endpoint",
    mimeType: "application/json",
  },
  server,
);
```

### Pattern 3: Client Fetch Wrapper for Autonomous Payments
**What:** Wraps native fetch to automatically handle 402 responses by signing payment and retrying.
**When to use:** Agent-to-agent service calls, autonomous bounty work.
**Example:**
```typescript
// src/lib/x402/client.ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { ExactEvmScheme } from "@x402/evm";

export function createPayingFetch(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: "eip155:*", // All EVM chains
        client: new ExactEvmScheme(account),
      },
    ],
  });
}
```

### Pattern 4: Direct USDC Transfer for Bounty Completion
**What:** Server-side viem call to transfer USDC when bounty is completed.
**When to use:** Bounty payout (not x402 gating -- direct transfer).
**Example:**
```typescript
// src/lib/chain/usdc.ts
import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "viem";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia
const USDC_DECIMALS = 6;

export async function transferUsdc(
  toAddress: `0x${string}`,
  amount: string, // e.g. "10.00"
) {
  const account = privateKeyToAccount(process.env.BOUNTY_PAYER_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const { request } = await publicClient.simulateContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "transfer",
    args: [toAddress, parseUnits(amount, USDC_DECIMALS)],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  return txHash;
}
```

### Anti-Patterns to Avoid
- **Using middleware.ts instead of proxy.ts:** Next.js 16 renamed middleware to proxy. The file MUST be proxy.ts.
- **Gating API routes only via proxy.ts:** Use `withX402` for API routes -- it settles payment AFTER the handler succeeds (status < 400), so users are not charged for errors.
- **Hardcoding agent wallet in proxy.ts for multi-agent services:** Each agent has a different payTo address. Use withX402 per-route or dynamically resolve from DB.
- **Sending real USDC on mainnet during development:** Always use Base Sepolia for testing. Circle faucet provides testnet USDC at faucet.circle.com.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP 402 payment flow | Custom 402 response + header parsing | @x402/next paymentProxy + withX402 | Protocol has specific header format, ERC-3009 signing, facilitator verification |
| Client payment signing | Manual ERC-3009 TransferWithAuthorization | @x402/fetch wrapFetchWithPaymentFromConfig | Handles 402 detection, retry, signing, header encoding |
| Payment verification | Manual on-chain verification | Coinbase facilitator (https://x402.org/facilitator) | Free tier handles verification + settlement; no smart contract needed |
| ERC-20 ABI definition | Writing transfer ABI by hand | `import { erc20Abi } from "viem"` | viem ships complete ERC-20 ABI |

**Key insight:** The x402 protocol has specific binary header encoding (base64), ERC-3009 authorization signing, and facilitator interaction. Hand-rolling any piece means reimplementing the protocol spec.

## Common Pitfalls

### Pitfall 1: middleware.ts vs proxy.ts in Next.js 16
**What goes wrong:** Creating middleware.ts instead of proxy.ts
**Why it happens:** All x402 tutorials before Next.js 16 use middleware.ts; the legacy `x402-next` package exports `paymentMiddleware`
**How to avoid:** Use `proxy.ts` at project root (or `src/proxy.ts`). Use `@x402/next` (NOT `x402-next`), which exports `paymentProxy`.
**Warning signs:** Proxy code never executes; requests pass through ungated

### Pitfall 2: Charging for Failed Requests
**What goes wrong:** Using paymentProxy for API routes means payment settles before the handler runs. If the handler returns 500, user already paid.
**Why it happens:** paymentProxy is designed for page routes where "access" is the product
**How to avoid:** Use `withX402` wrapper for API routes -- it settles payment ONLY after a successful response
**Warning signs:** Users complaining about being charged for errors

### Pitfall 3: Dynamic payTo Address for Multi-Agent Services
**What goes wrong:** All payments go to a single hardcoded address instead of the specific agent providing the service
**Why it happens:** The proxy.ts route config requires static payTo addresses
**How to avoid:** Use withX402 per API route handler where you can dynamically look up the agent's wallet from DB. Or use a single operator wallet and distribute later.
**Warning signs:** Agents not receiving payments for their services

### Pitfall 4: USDC Decimals
**What goes wrong:** Sending 1000000x more or less USDC than intended
**Why it happens:** USDC has 6 decimals (not 18 like ETH). `parseUnits("1", 6)` = 1 USDC.
**How to avoid:** Always use `parseUnits(amount, 6)` for USDC amounts
**Warning signs:** Transfer amounts wildly wrong

### Pitfall 5: Private Key Exposure
**What goes wrong:** Agent private keys leaked in client bundle
**Why it happens:** Using private keys in client-side code
**How to avoid:** Agent payment client (`@x402/fetch`) runs server-side only. Environment variables with private keys must NOT have `NEXT_PUBLIC_` prefix.
**Warning signs:** Private key visible in browser devtools

### Pitfall 6: Network Mismatch
**What goes wrong:** x402 configured for one network but USDC transfer on another
**Why it happens:** Mixing up Base Sepolia (chain 84532) and Base mainnet (chain 8453)
**How to avoid:** Use consistent network identifiers: `eip155:84532` for x402, `baseSepolia` chain for viem
**Warning signs:** Payments settle on wrong chain, facilitator rejects requests

## Code Examples

### Bounty Completion with USDC Payment + Status
```typescript
// src/app/api/bounties/[id]/complete/route.ts (enhanced)
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { transferUsdc } from "@/lib/chain/usdc";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const { deliverable_url } = await req.json();

  const bounty = db.prepare("SELECT * FROM bounties WHERE id = ?").get(id) as any;
  if (!bounty || bounty.status !== "claimed") {
    return NextResponse.json({ error: "Invalid bounty state" }, { status: 400 });
  }

  // Look up agent wallet for payment
  const agent = db.prepare("SELECT wallet_address FROM agents WHERE id = ?").get(bounty.claimed_by) as any;
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Update status to pending before payment
  db.prepare("UPDATE bounties SET status = 'pending_payment' WHERE id = ?").run(id);

  try {
    const txHash = await transferUsdc(
      agent.wallet_address as `0x${string}`,
      bounty.reward_amount || "0",
    );

    db.prepare(`
      UPDATE bounties SET status = 'completed', deliverable_url = ?, tx_hash = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(deliverable_url || null, txHash, id);

    return NextResponse.json({ tx_hash: txHash, status: "completed" });
  } catch (err) {
    db.prepare("UPDATE bounties SET status = 'payment_failed' WHERE id = ?").run(id);
    return NextResponse.json({ error: "Payment failed", status: "payment_failed" }, { status: 502 });
  }
}
```

### Transaction Status UI Component
```typescript
// Source: Project pattern from bounty detail page
function TransactionStatus({ txHash, status }: { txHash: string | null; status: string }) {
  if (!txHash) return null;

  const baseScanUrl = `https://sepolia.basescan.org/tx/${txHash}`;
  const statusColor = {
    pending_payment: "text-yellow-300",
    completed: "text-green-300",
    payment_failed: "text-red-300",
  }[status] || "text-zinc-400";

  return (
    <div className="mt-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${statusColor}`}>
          Payment: {status === "completed" ? "Confirmed" : status === "pending_payment" ? "Pending" : "Failed"}
        </span>
        <a
          href={baseScanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          View on BaseScan
        </a>
      </div>
      <p className="text-xs text-zinc-600 mt-1 font-mono truncate">{txHash}</p>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `x402-next` package (legacy) | `@x402/next` (monorepo) | 2026 Q1 | New imports, paymentMiddleware renamed to paymentProxy |
| `paymentMiddleware` | `paymentProxy` | 2026 Q1 | Must use @x402/next not x402-next |
| middleware.ts | proxy.ts | Next.js 16 | File convention change; same functionality |
| Manual 402 handling | `withX402` route wrapper | 2026 Q1 | Settles after success, cleaner DX |

**Deprecated/outdated:**
- `x402-next` package: Replaced by `@x402/next` monorepo package
- `paymentMiddleware` export: Renamed to `paymentProxy` in new package
- `middleware.ts` file: Renamed to `proxy.ts` in Next.js 16

## Open Questions

1. **Dynamic per-agent payTo addresses in withX402**
   - What we know: withX402 config is defined at module level; agent wallet must come from DB
   - What's unclear: Whether withX402 accepts a function for payTo or only static config
   - Recommendation: If static only, use a platform operator wallet and track per-agent distributions in DB. For hackathon, a single operator wallet is sufficient.

2. **@x402/next compatibility with Next.js 16**
   - What we know: The DEV Community article confirms x402-next works with proxy.ts; @x402/next is the newer package
   - What's unclear: Whether @x402/next has been tested with Next.js 16.2.0 specifically
   - Recommendation: Install and test early. Fallback is manual proxy.ts implementation using @x402/core directly.

3. **Testnet USDC funding**
   - What we know: Circle faucet (faucet.circle.com) provides Base Sepolia USDC
   - What's unclear: Whether the bounty payer wallet is funded
   - Recommendation: Fund wallet before testing payment flow

## Sources

### Primary (HIGH confidence)
- [coinbase/x402 GitHub](https://github.com/coinbase/x402) - Monorepo structure, package names, example code
- [Coinbase x402 Next.js example](https://github.com/coinbase/x402/tree/main/examples/typescript/fullstack/next) - proxy.ts pattern, withX402 usage, ExactEvmScheme setup
- [Next.js 16 proxy.ts docs](node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md) - File convention, named export, matcher config
- [x402 Quickstart for Sellers](https://docs.x402.org/getting-started/quickstart-for-sellers) - Server setup, facilitator URL, route config
- [Circle USDC Contract Addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) - Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e

### Secondary (MEDIUM confidence)
- [Using x402-next with Next.js 16 (DEV Community)](https://dev.to/shahbaz17/using-x402-next-with-nextjs-16-1me1) - Confirms proxy.ts pattern works
- [@x402/fetch npm](https://www.npmjs.com/package/@x402/fetch) - wrapFetchWithPaymentFromConfig API
- [QuickNode x402 Guide](https://www.quicknode.com/guides/infrastructure/how-to-use-x402-payment-required) - Facilitator URL confirmation

### Tertiary (LOW confidence)
- None -- all critical claims verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Coinbase monorepo with clear package structure
- Architecture: HIGH - proxy.ts pattern confirmed in Next.js 16 docs + x402 example
- Pitfalls: HIGH - proxy.ts vs middleware.ts confirmed; USDC decimals well-known
- withX402 dynamic config: MEDIUM - API shape confirmed from example but dynamic payTo not verified

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (x402 is actively developed; check for breaking changes)
