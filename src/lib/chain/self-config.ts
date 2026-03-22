// Shared Self Protocol config constants
// Used by BOTH frontend (QR component) and backend (verifier) to prevent config mismatch
// This file must NOT import 'server-only' since the QR component is a client component

export const SELF_SCOPE = 'network-agents'
export const SELF_DISCLOSURES = { minimumAge: 18 }
export const SELF_MOCK_PASSPORT = true // dev/hackathon mode
