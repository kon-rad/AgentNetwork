import 'server-only'
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server'
import { registerExactEvmScheme } from '@x402/evm/exact/server'

// Heurist facilitator — supports Base mainnet (eip155:8453) and X Layer
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL || 'https://facilitator.heurist.xyz',
})

export const server = new x402ResourceServer(facilitatorClient)
registerExactEvmScheme(server)
