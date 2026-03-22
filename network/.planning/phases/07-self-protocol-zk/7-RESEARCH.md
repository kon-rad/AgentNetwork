# Phase 7: Self Protocol ZK - Research

**Researched:** 2026-03-21
**Domain:** Zero-knowledge passport verification via Self Protocol on Celo
**Confidence:** HIGH

## Summary

Self Protocol provides ZK-based identity verification using biometric passports (129 countries), national ID cards (35 countries), and Aadhaar. The integration has two approaches: **backend verification** (simpler, off-chain proof validation via `@selfxyz/core`) and **contract verification** (on-chain, requires deploying a Solidity contract extending `SelfVerificationRoot`). For a hackathon demo, backend verification is the pragmatic choice -- it avoids Solidity deployment complexity while still demonstrating the ZK verification flow end-to-end.

The frontend uses `@selfxyz/qrcode` to render a QR code that the Self mobile app scans. The user scans their passport with the Self app, which generates a ZK proof and submits it to your backend `/api/verify` endpoint. The backend validates the proof via `SelfBackendVerifier`, and on success, marks the agent as verified in SQLite. The existing codebase already has `self_verified` column in the agents table and badge rendering in both `agent-card.tsx` and the agent profile page -- Phase 7 only needs to wire up the verification flow.

**Primary recommendation:** Use backend verification approach with `@selfxyz/core` + `@selfxyz/qrcode`. No Solidity contract deployment needed. Celo chain config is only relevant if using the contract approach; backend verification validates against the Celo IdentityVerificationHub remotely.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SELF-01 | Verification page where agent operator scans passport via Self Protocol QR code | `@selfxyz/qrcode` SelfQRcodeWrapper component with SelfAppBuilder config renders scannable QR |
| SELF-02 | Backend verifier validates ZK proof from Self Protocol | `SelfBackendVerifier` from `@selfxyz/core` validates proofs server-side against Celo hub |
| SELF-03 | Verified agents display "ZK Verified" badge on profile | Already implemented in agent-card.tsx and agent/[id]/page.tsx -- reads `self_verified` column |
| SELF-04 | Verification uses Self Protocol on Celo (separate from Base chain config) | Backend verifier targets Celo hub internally; no wagmi/viem Celo chain config needed for backend approach |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @selfxyz/core | 1.2.0-beta.1 | Backend ZK proof verification | Official Self Protocol SDK; provides SelfBackendVerifier |
| @selfxyz/qrcode | 1.0.22 | Frontend QR code component | Official React component for Self app scanning |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @selfxyz/contracts | 1.2.3 | Solidity contracts for on-chain verification | NOT needed for backend approach; only for contract-based verification |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Backend verification | Contract verification (deploy Solidity to Celo) | On-chain is more "real" but requires Foundry, Celo gas tokens, contract deployment -- overkill for hackathon |

**Installation:**
```bash
pnpm add @selfxyz/core@1.2.0-beta.1 @selfxyz/qrcode@1.0.22
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    chain/
      self.ts           # SelfBackendVerifier singleton, verify() helper
  app/
    api/
      self/
        verify/
          route.ts      # POST /api/self/verify — receives proof from Self relayer
    verify/
      [agentId]/
        page.tsx        # Verification page with QR code for specific agent
  components/
    self/
      self-qr.tsx       # Client component wrapping SelfQRcodeWrapper
```

### Pattern 1: Backend Verification Flow
**What:** Self app sends proof to your backend endpoint; backend validates and updates DB
**When to use:** Hackathon demos, apps that don't need on-chain attestation records

```
User visits /verify/[agentId]
  -> SelfQRcodeWrapper renders QR code (configured with endpoint = /api/self/verify)
  -> User scans QR with Self app, scans passport
  -> Self app generates ZK proof
  -> Self relayer POSTs proof to /api/self/verify
  -> Backend SelfBackendVerifier.verify() validates proof
  -> On success: UPDATE agents SET self_verified = 1 WHERE wallet_address = userIdentifier
  -> Frontend polls or redirects to show updated badge
```

### Pattern 2: SelfBackendVerifier Configuration
**What:** Server-side verifier instance with matching config to frontend
**Critical:** Frontend and backend configurations MUST match exactly or verification fails.

```typescript
// Source: https://docs.self.xyz/backend-integration/basic-integration
import { SelfBackendVerifier, DefaultConfigStore, AllIds } from '@selfxyz/core';

const verifier = new SelfBackendVerifier(
  'network-agents',                    // scope - must match frontend
  'https://your-domain/api/self/verify', // endpoint - your verify route
  true,                                 // mockPassport: true for testnet/dev
  AllIds,                               // accept all document types
  new DefaultConfigStore({
    minimumAge: 18,
    excludedCountries: [],
    ofac: false,
  }),
  'hex'                                 // userIdentifierType - EVM address
);
```

### Pattern 3: Frontend QR Component
**What:** React component rendering Self Protocol QR code
**Critical:** `scope`, `endpoint`, and disclosure config must match backend exactly.

```typescript
// Source: https://docs.self.xyz/frontend-integration/qrcode-sdk
'use client';
import { SelfAppBuilder } from '@selfxyz/qrcode';
import { SelfQRcodeWrapper } from '@selfxyz/qrcode';

const selfApp = new SelfAppBuilder({
  appName: 'Network',
  scope: 'network-agents',
  endpoint: '/api/self/verify',
  endpointType: 'staging_celo',   // or 'celo' for mainnet
  userId: walletAddress,           // agent operator wallet
  userIdType: 'hex',
  disclosures: {
    minimumAge: 18,
  },
}).build();

// Render: <SelfQRcodeWrapper selfApp={selfApp} onSuccess={...} onError={...} />
```

### Anti-Patterns to Avoid
- **Mismatched frontend/backend config:** If frontend requests `minimumAge: 18` but backend expects `minimumAge: 21`, verification fails silently. Define config constants in a shared file.
- **Using contract approach for hackathon:** Deploying Solidity to Celo requires Foundry, gas tokens, and adds deployment complexity. Backend verification demonstrates the same ZK flow.
- **Adding Celo to wagmi chain config:** The backend verifier handles Celo hub communication internally. Adding Celo to RainbowKit chains would confuse users with network switch prompts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZK proof validation | Custom ZK circuit verification | SelfBackendVerifier.verify() | ZK proof verification is cryptographically complex; the SDK handles snark verification against the Celo hub |
| QR code generation for Self app | Custom QR with deep links | SelfQRcodeWrapper | The component handles the Self app protocol, deep links, and proof relay |
| Passport data extraction | Manual parsing of proof outputs | SelfBackendVerifier response.discloseOutput | SDK extracts nationality, age, gender etc. from ZK proofs |

## Common Pitfalls

### Pitfall 1: Config Mismatch Between Frontend and Backend
**What goes wrong:** Verification always fails with opaque errors
**Why it happens:** Frontend disclosure config and backend DefaultConfigStore have different values
**How to avoid:** Define a shared config object in `src/lib/chain/self.ts` that both frontend and backend import
**Warning signs:** Proofs submit successfully (200 response) but `result: false` with generic "Verification failed"

### Pitfall 2: mockPassport Flag
**What goes wrong:** Real passports fail on testnet, mock passports fail on mainnet
**Why it happens:** `mockPassport: true` targets Celo testnet hub (0x16ECBA51...), `false` targets mainnet hub (0xe57F4773...)
**How to avoid:** Use `true` for development/demo. Only switch to `false` for production with real passports.
**Warning signs:** "Hub verification failed" errors

### Pitfall 3: Self App Not Installed
**What goes wrong:** QR code renders but scanning does nothing useful
**Why it happens:** User needs the Self mobile app to scan QR and generate proofs
**How to avoid:** Show clear instructions: "Download Self app from App Store / Google Play, register your passport, then scan this QR code"
**Warning signs:** Users report QR code "doesn't work"

### Pitfall 4: Endpoint Accessibility
**What goes wrong:** Self relayer can't reach your /api/self/verify endpoint
**Why it happens:** localhost is not accessible from the Self relayer service
**How to avoid:** Use ngrok or a deployed URL for the endpoint. For hackathon demo, use the deployed Vercel URL.
**Warning signs:** QR scans successfully in Self app but no POST arrives at your endpoint

### Pitfall 5: HTTP 200 for All Responses
**What goes wrong:** Frontend treats verification errors as server errors
**Why it happens:** Self Protocol convention returns HTTP 200 for both success and failure; status is in the JSON body
**How to avoid:** Check `response.status === "success"` and `response.result === true`, not HTTP status code

## Code Examples

### Backend Verify Route (Next.js App Router)
```typescript
// src/app/api/self/verify/route.ts
// Source: https://docs.self.xyz/backend-integration/basic-integration (adapted for Next.js)
import { NextRequest, NextResponse } from 'next/server';
import { SelfBackendVerifier, DefaultConfigStore, AllIds } from '@selfxyz/core';
import { getDb } from '@/lib/db';

const verifier = new SelfBackendVerifier(
  'network-agents',
  process.env.NEXT_PUBLIC_APP_URL + '/api/self/verify',
  true, // mockPassport for dev
  AllIds,
  new DefaultConfigStore({
    minimumAge: 18,
    excludedCountries: [],
    ofac: false,
  }),
  'hex'
);

export async function POST(req: NextRequest) {
  const { attestationId, proof, publicSignals, userContextData } = await req.json();

  if (!proof || !publicSignals || !attestationId || !userContextData) {
    return NextResponse.json({
      status: 'error',
      result: false,
      reason: 'Missing required fields',
    });
  }

  try {
    const result = await verifier.verify(attestationId, proof, publicSignals, userContextData);
    const { isValid } = result.isValidDetails;

    if (!isValid) {
      return NextResponse.json({ status: 'error', result: false, reason: 'Verification failed' });
    }

    // Extract wallet address from userIdentifier and mark agent verified
    const userWallet = result.userData?.userIdentifier;
    if (userWallet) {
      const db = getDb();
      db.prepare('UPDATE agents SET self_verified = 1 WHERE wallet_address = ?').run(userWallet);
    }

    return NextResponse.json({ status: 'success', result: true });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      result: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

### Frontend QR Component
```typescript
// src/components/self/self-qr.tsx
'use client';
import { SelfAppBuilder, SelfQRcodeWrapper } from '@selfxyz/qrcode';

interface SelfQRProps {
  userId: string;  // agent operator wallet address
  onSuccess: () => void;
}

export function SelfQR({ userId, onSuccess }: SelfQRProps) {
  const selfApp = new SelfAppBuilder({
    appName: 'Network',
    scope: 'network-agents',
    endpoint: `${window.location.origin}/api/self/verify`,
    endpointType: 'staging_celo',
    userId,
    userIdType: 'hex',
    disclosures: { minimumAge: 18 },
  }).build();

  return (
    <SelfQRcodeWrapper
      selfApp={selfApp}
      onSuccess={onSuccess}
      onError={(error) => console.error('Self verification error:', error)}
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenPassport (separate project) | Self Protocol (acquired OpenPassport) | 2025 | Self Protocol is the successor; use @selfxyz/* packages |
| Hub V1 | Hub V2 (IdentityVerificationHubV2) | Late 2025 | Contract integration uses V2 interfaces; backend SDK handles this internally |

**Deprecated/outdated:**
- OpenPassport npm packages: replaced by @selfxyz/*
- Hub V1 contract interfaces: superseded by V2

## Existing Codebase Support

The following already exist and do NOT need to be created:

| Item | Location | Status |
|------|----------|--------|
| `self_verified` DB column | src/lib/db.ts:39 | INTEGER DEFAULT 0 -- ready |
| `self_verified` in Agent type | src/lib/types.ts:14 | number field -- ready |
| ZK Verified badge on profile | src/app/agent/[id]/page.tsx:60-62 | Renders when self_verified truthy -- ready |
| Verified badge on agent card | src/components/agents/agent-card.tsx:26-28 | Renders when self_verified truthy -- ready |

**What Phase 7 must build:**
1. `src/lib/chain/self.ts` -- Self Protocol config + verifier helper
2. `src/app/api/self/verify/route.ts` -- POST endpoint receiving proofs
3. `src/app/verify/[agentId]/page.tsx` -- Verification page with QR code
4. `src/components/self/self-qr.tsx` -- Client component for QR rendering

## Celo Contract Addresses (Reference Only)

For backend verification, the SDK handles hub communication. Listed for reference:

| Network | Contract | Address |
|---------|----------|---------|
| Celo Mainnet | IdentityVerificationHub | 0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF |
| Celo Testnet | IdentityVerificationHub | 0x16ECBA51e18a4a7e61fdC417f0d47AFEeDfbed74 |

## Open Questions

1. **ngrok / deployed URL for Self relayer callback**
   - What we know: Self relayer needs to POST to a publicly accessible URL
   - What's unclear: Whether Vercel preview URLs work, or if ngrok is needed for dev
   - Recommendation: Use NEXT_PUBLIC_APP_URL env var; for local dev use ngrok

2. **Mock passport availability**
   - What we know: `mockPassport: true` enables testnet mode
   - What's unclear: Whether Self app has a "test mode" for generating mock proofs without a real passport
   - Recommendation: Set `mockPassport: true` and check Self docs/Discord for test passport generation

3. **SelfAppBuilder version parameter**
   - What we know: Docs show `version: 2` in some examples
   - What's unclear: Whether this is required or has a default
   - Recommendation: Include `version: 2` in SelfAppBuilder config to be safe

## Sources

### Primary (HIGH confidence)
- [Self Backend Integration Docs](https://docs.self.xyz/backend-integration/basic-integration) - SelfBackendVerifier API, Express example, response format
- [Self QRCode SDK Docs](https://docs.self.xyz/frontend-integration/qrcode-sdk) - SelfQRcodeWrapper, SelfAppBuilder config
- [Self Contract Integration Docs](https://docs.self.xyz/contract-integration/basic-integration) - SelfVerificationRoot, Hub V2
- [Self Deployed Contracts](https://docs.self.xyz/contract-integration/deployed-contracts) - Celo mainnet/testnet hub addresses

### Secondary (MEDIUM confidence)
- [Celo Build with Self](https://docs.celo.org/build-on-celo/build-with-self) - Confirms Celo integration exists
- npm registry - Package versions verified: @selfxyz/core@1.2.0-beta.1, @selfxyz/qrcode@1.0.22, @selfxyz/contracts@1.2.3

### Tertiary (LOW confidence)
- SelfAppBuilder `version` and `endpointType` exact values -- docs show examples but full enum not documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - packages verified on npm, docs reviewed
- Architecture: HIGH - backend verification pattern well-documented with Express example; adaptation to Next.js is straightforward
- Pitfalls: HIGH - config mismatch and endpoint accessibility are documented in official docs
- Existing codebase support: HIGH - verified by reading actual source files

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- Self Protocol is post-launch)
