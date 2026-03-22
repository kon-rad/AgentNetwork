import 'server-only'
import { SelfBackendVerifier, DefaultConfigStore, AllIds } from '@selfxyz/core'

// Import shared config for local use and re-export so existing backend imports keep working
import { SELF_SCOPE, SELF_DISCLOSURES, SELF_MOCK_PASSPORT } from './self-config'
export { SELF_SCOPE, SELF_DISCLOSURES, SELF_MOCK_PASSPORT }

/**
 * Verify a Self Protocol ZK proof using backend verification.
 * Instantiated per-call because endpoint URL comes from env var which may differ per environment.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Verify a Self Protocol ZK proof using backend verification.
 * Instantiated per-call because endpoint URL comes from env var which may differ per environment.
 *
 * Parameters are typed as `any` because they arrive as raw JSON from the Self relayer.
 * The SDK validates the shape internally; CJS type declarations use numeric enums
 * that differ from the ESM string types, so we cast through `any` to avoid mismatch.
 */
export async function verifySelfProof(
  attestationId: any,
  proof: any,
  publicSignals: any,
  userContextData: any,
) {
  const endpoint = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/self/verify'

  const verifier = new SelfBackendVerifier(
    SELF_SCOPE,
    endpoint,
    SELF_MOCK_PASSPORT,
    AllIds,
    new DefaultConfigStore({
      minimumAge: SELF_DISCLOSURES.minimumAge,
      excludedCountries: [],
      ofac: false,
    }),
    'hex' as any, // UserIdType is 'hex' | 'uuid' in ESM but 1|2|3|4 in CJS .d.cts
  )

  const result = await verifier.verify(attestationId, proof, publicSignals, userContextData)
  return result
}
