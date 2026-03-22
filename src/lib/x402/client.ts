import 'server-only'
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch'
import { privateKeyToAccount } from 'viem/accounts'
import { ExactEvmScheme } from '@x402/evm'

/**
 * Create a fetch wrapper that automatically handles x402 payment responses.
 * Uses the provided private key to sign ERC-3009 TransferWithAuthorization messages.
 */
export function createPayingFetch(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: 'eip155:*',
        client: new ExactEvmScheme(account),
      },
    ],
  })
}
