# World ID Mini App + Sign-In Design

**Date**: 2026-03-29
**Status**: Approved
**Scope**: Add MiniKit-based sign-in for World App users alongside existing RainbowKit auth, plus opt-in World ID human verification on agent profiles.

## Problem Statement

The app currently uses RainbowKit + SIWE for desktop wallet auth. To participate in the Worldcoin ecosystem and enable human-backed agent verification, we need:
1. The app to work as a Mini App inside World App (mobile)
2. World App users to sign in via MiniKit's walletAuth
3. Agent owners to optionally verify as human via World ID, completing the AgentKit/AgentBook flow

## Architecture

Dual-mode auth: `MiniKit.isInstalled()` branches the UI.

```
World App (mobile)                    Desktop Browser
     |                                      |
     v                                      v
MiniKit.isInstalled() === true    MiniKit.isInstalled() === false
     |                                      |
     v                                      v
MiniKit walletAuth()              RainbowKit + SIWE (existing)
     |                                      |
     +----------> Same Backend <------------+
              iron-session cookie
              owner_wallet in agents table
```

### Why Dual-Mode Works

MiniKit's `walletAuth` produces the same SIWE message format as the existing RainbowKit flow. The backend (iron-session + `owner_wallet`) doesn't need to change. The only difference is how the frontend collects the signature.

### World ID Verify (Opt-In)

Separate from sign-in. Lives on the agent profile page as a "Verify as Human" button. Uses MiniKit's `verify` command to produce a ZK proof, verified server-side via `verifyCloudProof`. On success:
- Stores `nullifier_hash` in Supabase (anti-replay)
- Sets `agentbook_registered = true` on the agent's wallet
- Stores verification level (orb/device) on the agent record

## Components

### 1. MiniKitProvider (root layout)

Add `MiniKitProvider` from `@worldcoin/minikit-js/minikit-provider` wrapping the app in `providers-inner.tsx`, alongside existing Wagmi/RainbowKit providers.

### 2. Navbar Dual-Mode Sign-In

The navbar detects `MiniKit.isInstalled()`:
- **World App**: Shows "SIGN IN WITH WORLD" button that calls MiniKit walletAuth
- **Desktop**: Shows existing RainbowKit ConnectButton + SIWE flow (unchanged)

Both flows end with the same iron-session cookie containing `address` + `authenticated`.

### 3. MiniKit Auth API Routes

- `GET /api/auth/minikit/nonce` — Generate nonce, store in cookie (same pattern as existing SIWE nonce)
- `POST /api/auth/minikit/verify` — Verify MiniKit SIWE payload using `verifySiweMessage` from `@worldcoin/minikit-js`, create iron-session

### 4. World ID Verify Component

New component on agent profile page. Only visible to agent owner. Shows "Verify as Human" button with level choice (Orb/Device).

### 5. World ID Verify API Route

`POST /api/auth/world-id/verify` — Accepts proof payload + agent ID, calls `verifyCloudProof`, stores nullifier, updates agent wallet.

### 6. Supabase Migration

New table for nullifier anti-replay + verification level column on agents.

## Implementation Order

1. Install @worldcoin/minikit-js
2. Add MiniKitProvider to providers
3. Create minikit auth API routes (nonce + verify)
4. Update navbar with dual-mode sign-in
5. Create World ID verify API route
6. Create verify-human component on agent profile
7. Supabase migration
8. Update .env with NEXT_PUBLIC_WORLD_APP_ID, WORLD_DEV_PORTAL_API_KEY
