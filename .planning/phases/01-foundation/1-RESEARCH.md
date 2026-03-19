# Phase 1: Foundation - Research

**Researched:** 2026-03-20
**Domain:** Wallet connection (RainbowKit/wagmi v2), ENS resolution, cyberpunk UI (Tailwind CSS 4), Next.js 16 provider patterns
**Confidence:** HIGH (core stack verified against official docs and installed node_modules)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Platform has a high-tech cyberpunk aesthetic with glassmorphism cards, electric cyan accents, noise texture, and grid background | CSS already partially implemented in globals.css — needs component-level application; `.glass-card`, `.shimmer`, `.text-glow-cyan` classes exist |
| UI-02 | Responsive layout works on desktop and tablet | Tailwind CSS 4 responsive utilities (`md:`, `lg:`) — no new dependencies needed |
| UI-03 | Page transitions and card hover animations provide visual polish | CSS keyframes already defined in globals.css (`fadeInUp`, `fadeIn`); hover states on `.glass-card`; CSS View Transitions API available in Next.js 16 via React 19.2 |
| UI-04 | Loading states use shimmer/skeleton effects instead of blank screens | `.shimmer` class already defined in globals.css — needs skeleton component wrappers |
| WALL-01 | User can connect wallet via RainbowKit (MetaMask, Trust Wallet, Ronin, WalletConnect) | RainbowKit 2.2.10 + wagmi ^2.x; not yet installed — needs `pnpm add @rainbow-me/rainbowkit wagmi viem@2 @tanstack/react-query` |
| WALL-02 | Connected wallet address displayed in navbar (truncated or ENS name) | `useAccount` hook from wagmi; navbar.tsx exists but has placeholder button only |
| WALL-03 | Wrong network prompts user to switch to Base | RainbowKit built-in chain switching UI; configure `chains: [base, baseSepolia]` in wagmi config |
| WALL-04 | Wallet connection persists across page refresh (wagmi SSR with cookieStorage) | `ssr: true` + `cookieStorage` in `createConfig`; pass `initialState` via `cookies()` from Next.js headers |
| WALL-05 | Webpack 5 polyfills configured for web3 libraries (Buffer, process, crypto) | CRITICAL: Next.js 16 uses Turbopack by default — polyfill approach differs from Webpack 5 (uses `turbopack.resolveAlias` instead of `webpack.resolve.fallback`) |
| ENS-01 | Agent profiles display ENS name instead of hex address when available | `useEnsName` wagmi hook; agent-card.tsx already has `agent.ens_name` field rendering |
| ENS-02 | ENS resolution uses chainId: 1 (Ethereum mainnet) explicitly | Pass `chainId: 1` to `useEnsName`; requires mainnet transport configured in wagmi config |
| ENS-03 | Fallback to truncated hex address when no ENS name set | Handle `null` return from `useEnsName`; truncation utility needed |
| ENS-04 | ENS names used in bounty board, feed posts, and follow lists | Shared `useDisplayName(address)` hook pattern needed across components |
</phase_requirements>

---

## Summary

Phase 1 establishes three interconnected foundations: cyberpunk UI polish, wallet connection, and ENS resolution. The existing codebase already has significant groundwork — `globals.css` has the full cyberpunk design system (colors, animations, glassmorphism classes), but component-level application is incomplete (components use generic `border-zinc-800` instead of the cyberpunk design tokens). The navbar has a placeholder Connect button with no actual wallet logic.

The biggest technical concern for this phase is the **Turbopack default in Next.js 16**. The existing PITFALLS.md assumes Webpack 5 polyfills via `next.config.js` `webpack.resolve.fallback`, but Next.js 16.2.0 (the installed version) builds with Turbopack by default. Adding a `webpack` key to `next.config.ts` will now cause `next build` to fail with a misconfiguration error unless `--webpack` flag is used. The Turbopack equivalent is `turbopack.resolveAlias` — this is a breaking change from the assumed approach.

The wagmi/RainbowKit SSR provider setup for Next.js App Router is well-documented and verified. The key pattern is: create a `'use client'` Providers component that wraps `WagmiProvider` + `QueryClientProvider` + `RainbowKitProvider`, read cookies server-side in `layout.tsx` using `await cookies()` (async in Next.js 16 — synchronous access was removed), pass as `initialState` to `WagmiProvider`.

**Primary recommendation:** Install RainbowKit stack, fix providers with SSR config, apply cyberpunk design tokens to existing components, and configure ENS resolution with explicit `chainId: 1` — all in one coherent phase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@rainbow-me/rainbowkit` | 2.2.10 | Wallet picker UI (MetaMask, WalletConnect, Trust, Ronin, Coinbase) | Only wallet UI library meeting hackathon's explicit wallet requirements; polished cyberpunk-compatible modal |
| `wagmi` | ^2.17+ (NOT v3) | React hooks for Ethereum (useAccount, useEnsName, useChainId) | Required by RainbowKit 2.x; v3 is incompatible with RainbowKit 2.x as of March 2026 |
| `viem` | 2.x | Low-level Ethereum client for ENS resolution and contract calls | RainbowKit and wagmi peer dependency; handles ENS, address utilities, chain definitions |
| `@tanstack/react-query` | ^5.x | Async state management for wagmi hooks | Required wagmi v2 peer dep |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `next/font/google` (existing) | Font loading | Already configured — Syne font is in globals.css theme but Geist is in layout.tsx; reconcile |
| Tailwind CSS 4 (existing) | Utility CSS | All component styling; cyberpunk tokens already in globals.css `@theme` block |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RainbowKit 2.x | Dynamic.xyz, Privy | Social login (email/SMS) — not needed, contradicts wallet-as-identity architecture |
| RainbowKit 2.x | ConnectKit | Lighter bundle — but RainbowKit is Base ecosystem standard |
| wagmi v2 | wagmi v3 | Switch only after RainbowKit ships v3 support (tracked at rainbowkit/discussions#2575) |

**Installation:**
```bash
pnpm add @rainbow-me/rainbowkit wagmi viem@2 @tanstack/react-query
```

---

## Architecture Patterns

### Recommended Project Structure After Phase 1
```
src/
├── app/
│   ├── layout.tsx              # Server Component — reads cookies, passes initialState
│   ├── globals.css             # Cyberpunk design system (already exists)
│   └── [pages]/                # All pages use .glass-card, .shimmer patterns
├── components/
│   ├── layout/
│   │   ├── navbar.tsx          # Update: real ConnectButton, ENS name display
│   │   └── providers.tsx       # NEW: 'use client' — WagmiProvider + RainbowKitProvider
│   ├── ui/
│   │   └── skeleton.tsx        # NEW: skeleton loader components using .shimmer
│   └── agents/
│       └── agent-card.tsx      # Update: apply .glass-card class, show ENS name
└── lib/
    ├── wagmi.ts                # NEW: wagmi createConfig, chain setup
    └── hooks/
        └── use-display-name.ts # NEW: address → ENS name or truncated hex
```

### Pattern 1: Next.js 16 SSR Provider Setup

**What:** Providers component that handles wagmi SSR with cookieStorage, compatible with Next.js 16's async Request APIs.

**When to use:** Required for WALL-04 — wallet state persists across page refresh.

**Critical Next.js 16 change:** `cookies()` is now fully async. In layout.tsx, you must `await cookies()` (synchronous access was removed in Next.js 16).

```typescript
// Source: wagmi official SSR guide + Next.js 16 breaking changes
// src/components/layout/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { WagmiProvider, cookieToInitialState } from 'wagmi'
import { wagmiConfig } from '@/lib/wagmi'
import { useState } from 'react'

export function Providers({
  children,
  cookie,
}: {
  children: React.ReactNode
  cookie?: string | null
}) {
  const [queryClient] = useState(() => new QueryClient())
  const initialState = cookieToInitialState(wagmiConfig, cookie)

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

```typescript
// src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base, baseSepolia, mainnet } from 'viem/chains'
import { cookieStorage, createStorage } from 'wagmi'

export const wagmiConfig = getDefaultConfig({
  appName: 'Network',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [base, baseSepolia, mainnet],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
})
```

```typescript
// src/app/layout.tsx (updated)
// Source: Next.js 16 async Request APIs — cookies() is now async
import { cookies } from 'next/headers'
import { Providers } from '@/components/layout/providers'

export default async function RootLayout({ children }) {
  const cookieStore = await cookies()  // MUST await in Next.js 16
  const cookie = cookieStore.toString()

  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[--color-bg-primary] text-[--color-text-primary]">
        <Providers cookie={cookie}>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
```

### Pattern 2: ENS Resolution with Fallback

**What:** A hook that resolves an Ethereum address to an ENS name, falling back to truncated hex.

**When to use:** WALL-02, ENS-01, ENS-02, ENS-03, ENS-04 — used anywhere an address is displayed.

```typescript
// src/lib/hooks/use-display-name.ts
// Source: wagmi docs https://wagmi.sh/react/api/hooks/useEnsName
import { useEnsName } from 'wagmi'
import { mainnet } from 'viem/chains'

export function useDisplayName(address?: `0x${string}`) {
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,  // ALWAYS chainId: 1 — ENS lives on Ethereum mainnet
  })

  if (!address) return null
  if (ensName) return ensName
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
```

### Pattern 3: Turbopack-Compatible Polyfills (Next.js 16)

**What:** Replace webpack `resolve.fallback` with Turbopack `resolveAlias` for Node.js module polyfills.

**When to use:** WALL-05 — required before installing any Web3 SDK that uses Buffer/crypto/process.

**CRITICAL:** Next.js 16 uses Turbopack by default. Adding `webpack:` to `next.config.ts` causes `next build` to fail. Use `turbopack.resolveAlias` instead OR build with `--webpack` flag. Since wagmi and viem are Turbopack-safe (they explicitly handle bundler environments), and RainbowKit is also safe, the polyfill requirement is mainly for future phases (Synapse SDK, etc.). For Phase 1, verify that `pnpm build` passes after installing the wallet stack.

```typescript
// Source: Next.js 16 upgrade guide — turbopack.resolveAlias replaces webpack.resolve.fallback
// next.config.ts — ONLY add if build fails with "Can't resolve 'crypto'" etc.
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Only add these if build fails — wagmi/viem/rainbowkit are turbopack-safe
      // crypto: { browser: './src/lib/empty.ts' },
      // stream: { browser: './src/lib/empty.ts' },
    },
  },
}

export default nextConfig
```

### Pattern 4: Cyberpunk UI Component Application

**What:** Apply existing design tokens from globals.css to component classes.

**When to use:** UI-01, UI-02, UI-03, UI-04 — all existing components need cyberpunk polish.

The globals.css already defines the full design system. The gap is that existing components (agent-card.tsx, bounty-card.tsx, post-card.tsx, navbar.tsx) use generic Tailwind classes (`border-zinc-800`, `bg-zinc-900`) instead of the cyberpunk token classes (`.glass-card`, `text-[--color-cyan]`, `.text-glow-cyan`).

```typescript
// Before (current agent-card.tsx)
<Link className="block border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-900/50 transition-all">

// After (cyberpunk)
<Link className="glass-card block rounded-xl p-5">
// glass-card provides: glassmorphism bg, cyan border, hover glow, translateY(-2px) on hover
```

### Anti-Patterns to Avoid

- **Putting WagmiProvider in a Server Component:** Results in "You're importing a component that needs" error. Always wrap in `'use client'` component.
- **Using synchronous `cookies()` in Next.js 16:** `const cookie = cookies().toString()` throws — must `await cookies()`. This is a hard breaking change from Next.js 15.
- **Calling `useEnsName` without `chainId: 1`:** Returns `null` for all addresses when wallet is connected to Base (chain 1 vs chain 8453).
- **Adding `webpack:` config in next.config.ts:** Causes `next build` to fail in Next.js 16 which defaults to Turbopack. Use `turbopack.resolveAlias` or `next build --webpack`.
- **Not creating `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` env var:** RainbowKit will throw before any component renders.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wallet picker modal | Custom wallet selection UI | RainbowKit `<ConnectButton>` | 15+ wallets, WalletConnect QR, mobile wallet deep links, auto-reconnect — all included |
| ENS resolution caching | Custom cache layer | wagmi's built-in React Query caching | wagmi already uses React Query under the hood; staleTime/cacheTime configured automatically |
| Address truncation + ENS display | Custom display component | `useDisplayName` hook wrapping `useEnsName` | Combine in one hook — prevents inconsistent truncation logic across components |
| Network switching modal | Custom chain switch UI | RainbowKit built-in chain modal | RainbowKit shows "Wrong network" state automatically when configured chains don't include connected chain |
| Loading skeleton components | CSS-only spinning circle | Skeleton wrappers using existing `.shimmer` class | The shimmer keyframe and class already exist in globals.css |

**Key insight:** RainbowKit encapsulates extraordinary complexity (wallet discovery, QR code generation, mobile deeplinks, auto-reconnect, chain switching, ENS name display in button). Building any of this manually costs days and still produces inferior UX.

---

## Common Pitfalls

### Pitfall 1: Next.js 16 cookies() Must Be Awaited

**What goes wrong:** `const cookieStore = cookies()` (synchronous) throws a runtime error in Next.js 16. In Next.js 15 this was synchronous with a deprecation warning; in 16 it's a hard error.

**Why it happens:** Next.js 16 removed the temporary synchronous compatibility layer for Request-time APIs. `cookies()`, `headers()`, `params` in layouts/pages are now Promise-only.

**How to avoid:** Always write `const cookieStore = await cookies()` in Server Components. Run `npx next typegen` to get type-safe `PageProps` helpers.

**Warning signs:** Runtime error mentioning "cookies was called outside a request scope" or type errors about Promise<ReadonlyRequestCookies>.

### Pitfall 2: Turbopack Breaks Webpack Polyfill Config

**What goes wrong:** Adding `webpack: (config) => { config.resolve.fallback = {...} }` to next.config.ts causes `next build` to fail with "Custom Webpack config found" error because Next.js 16 defaults to Turbopack for builds.

**Why it happens:** Turbopack is now the default build tool in Next.js 16. Having a webpack config causes a build failure to prevent misconfiguration.

**How to avoid:**
1. First verify whether viem/wagmi/rainbowkit actually need polyfills (they are Turbopack-safe)
2. If polyfills are needed, use `turbopack.resolveAlias` in next.config.ts
3. If you must keep webpack config (e.g., for future SDK compatibility), add `next build --webpack` to package.json scripts

**Warning signs:** Build fails with "If your project has a custom webpack configuration and you run next build (which now uses Turbopack by default), the build will fail."

### Pitfall 3: wagmi/RainbowKit Hydration Mismatch

**What goes wrong:** Wallet connection state disappears on page reload; React hydration errors in console; "Hydration failed because initial UI does not match" warning.

**Why it happens:** Without `ssr: true` + `cookieStorage` in wagmi config, the server renders "disconnected" and the client hydrates "connected" — state mismatch.

**How to avoid:** Configure wagmi with `ssr: true` and `storage: createStorage({ storage: cookieStorage })`. Pass `initialState` from server-side cookie read to `WagmiProvider`.

**Warning signs:** Address appears briefly then disappears on hard refresh. Works in dev, breaks in production SSR.

### Pitfall 4: Font Inconsistency — Geist vs Syne

**What goes wrong:** The globals.css `@theme` block sets `--font-sans: var(--font-syne)` but layout.tsx loads Geist fonts. The Syne font variable is referenced but never loaded, causing the cyberpunk aesthetic to fall back to system fonts.

**Why it happens:** The CSS design tokens reference `--font-syne` but the font was never imported. The current layout loads Geist instead.

**How to avoid:** Either:
1. Add `Syne` from `next/font/google` to layout.tsx (alongside Geist Mono) and assign `className` variable, OR
2. Change globals.css `--font-sans` to `var(--font-geist-sans)` if Geist is acceptable

**Warning signs:** Rendered text uses system font instead of Syne/Geist; `--font-syne` CSS variable resolves to empty string.

### Pitfall 5: ENS Resolution Returns null on Base Chain

**What goes wrong:** All `useEnsName` queries return `null` even for known `.eth` addresses like `vitalik.eth`.

**Why it happens:** Without explicit `chainId: 1`, wagmi routes the ENS query to the user's currently connected chain (Base mainnet = chain 8453). ENS registry doesn't exist on Base — every lookup returns null silently.

**How to avoid:** Always pass `chainId: 1` (or `chainId: mainnet.id`) to all ENS hooks. Include `mainnet` in the wagmi config chains array so the mainnet transport is available.

**Warning signs:** ENS works with `chainId: 1` but not without it. Addresses with known `.eth` names show as truncated hex.

---

## Code Examples

### Complete wagmi Config with Multi-Chain (Base + Mainnet for ENS)
```typescript
// Source: wagmi official docs https://wagmi.sh/react/getting-started + RainbowKit docs
// src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base, baseSepolia, mainnet } from 'viem/chains'
import { cookieStorage, createStorage } from 'wagmi'

export const wagmiConfig = getDefaultConfig({
  appName: 'Network — Agentic Marketplace',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [base, baseSepolia, mainnet],
  // mainnet is required for ENS resolution even though the app runs on Base
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
})
```

### RainbowKit ConnectButton in Navbar
```typescript
// Source: RainbowKit docs https://rainbowkit.com/en-US/docs/connect-button
// src/components/layout/navbar.tsx
'use client'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

export function Navbar() {
  return (
    <nav className="border-b border-[--color-border] bg-[--color-bg-primary]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* logo + nav links */}
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="avatar"
        />
      </div>
    </nav>
  )
}
```

### Skeleton Loader Using Existing shimmer Class
```typescript
// Uses the .shimmer class already defined in globals.css
// src/components/ui/skeleton.tsx
export function AgentCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full shimmer shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded shimmer" />
          <div className="h-3 w-20 rounded shimmer" />
          <div className="h-8 w-full rounded shimmer mt-2" />
        </div>
      </div>
    </div>
  )
}
```

### Environment Variables Required
```bash
# .env.local
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_from_cloud.walletconnect.com
# Get free project ID at https://cloud.walletconnect.com
# Without this, RainbowKit throws before any component renders
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` with named `export const middleware` | `proxy.ts` with named `export function proxy` (or default export) | Next.js 16 | Rename file; for this phase only relevant if x402 is added (Phase 5) |
| Synchronous `cookies()` / `headers()` in layouts | `await cookies()` / `await headers()` | Next.js 16 (hard break, was deprecated in 15) | layout.tsx must be async and await cookies() before passing to Providers |
| `webpack.resolve.fallback` for Node polyfills | `turbopack.resolveAlias` | Next.js 16 (Turbopack default) | Web3 polyfill config approach changes entirely |
| `experimental.turbopack: {}` config | `turbopack: {}` (top-level) | Next.js 16 | Minor config location change |
| Manual ENS resolution via ethers.js v5 | `useEnsName` from wagmi with `chainId: 1` | wagmi v2 | No additional packages needed — ENS is first-class in wagmi |
| `experimental.ppr: true` | `cacheComponents: true` | Next.js 16 | Not relevant for Phase 1 |

**Deprecated/outdated:**
- `serverRuntimeConfig` / `publicRuntimeConfig` in next.config: removed in Next.js 16 — use `process.env` directly
- `next lint` command: removed in Next.js 16 — use `eslint` directly (already done in this project per `package.json` scripts)
- `next/legacy/image`: removed in Next.js 16 — use `next/image`

---

## Open Questions

1. **Font: Syne vs Geist**
   - What we know: `globals.css` references `--font-syne` in `@theme` block; `layout.tsx` loads Geist fonts; Syne is never imported
   - What's unclear: Is this intentional (Geist for now, Syne later)? Or an oversight?
   - Recommendation: During task execution, check if Syne is the intended cyberpunk font — it has a more geometric/tech feel than Geist. If so, add `Syne` via `next/font/google` and assign the variable. If Geist is fine, update `globals.css` `--font-sans` to reference `--font-geist-sans`.

2. **Turbopack + RainbowKit build compatibility**
   - What we know: wagmi and viem are documented as Turbopack-safe; RainbowKit imports viem/wagmi
   - What's unclear: Whether RainbowKit 2.2.10 has any internal dependency that isn't Turbopack-safe (causing build-time errors)
   - Recommendation: After `pnpm add`, run `pnpm build` before writing any business logic. If it fails, add `next build --webpack` to package.json scripts as a fallback.

3. **RainbowKit CSS styling conflict with Tailwind CSS 4**
   - What we know: RainbowKit injects its own CSS; Tailwind CSS 4 uses `@import "tailwindcss"` syntax (not `@tailwind base/components/utilities`)
   - What's unclear: Whether RainbowKit's `styles.css` conflicts with Tailwind 4 reset/base styles
   - Recommendation: Import `@rainbow-me/rainbowkit/styles.css` in the Providers component (client component), not in globals.css. Test modal appearance carefully.

---

## Sources

### Primary (HIGH confidence)
- `/node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — Next.js 16 breaking changes: async cookies(), Turbopack default, proxy.ts rename — verified directly from installed package
- [RainbowKit Installation docs](https://rainbowkit.com/en-US/docs/installation) — package versions, setup pattern
- [RainbowKit wagmi v3 incompatibility discussion](https://github.com/rainbow-me/rainbowkit/discussions/2575) — do NOT upgrade to wagmi v3
- [wagmi SSR guide](https://wagmi.sh/react/guides/ssr) — ssr: true, cookieStorage, initialState pattern
- [wagmi useEnsName docs](https://wagmi.sh/react/api/hooks/useEnsName) — chainId: 1 requirement

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — package versions verified, wagmi/RainbowKit/viem/TanStack Query versions
- `.planning/research/PITFALLS.md` — hydration mismatch, ENS on wrong chain, webpack polyfills (updated with Turbopack caveat)

### Tertiary (LOW confidence)
- Turbopack + RainbowKit runtime compatibility — not explicitly documented; needs verification during build

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed in STACK.md which cites official npm/GitHub sources; no web3 packages installed yet
- Architecture: HIGH — patterns sourced from official wagmi/RainbowKit docs and Next.js 16 upgrade guide read directly from node_modules
- Pitfalls: HIGH — Turbopack issue sourced directly from Next.js 16 docs in node_modules; ENS chain issue from official wagmi docs; hydration from official wagmi SSR guide

**Research date:** 2026-03-20
**Valid until:** 2026-04-03 (14 days — wagmi/RainbowKit stable; Next.js 16 newly released so monitor for patch releases)
