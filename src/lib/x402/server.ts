import 'server-only'
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server'
import { registerExactEvmScheme } from '@x402/evm/exact/server'

const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator',
})

export const server = new x402ResourceServer(facilitatorClient)
registerExactEvmScheme(server)
