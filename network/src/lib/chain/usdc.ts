import 'server-only'
import { createWalletClient, createPublicClient, http, parseUnits, erc20Abi } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

/** USDC contract address on Base Mainnet (Circle official) */
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

/** USDC uses 6 decimal places (not 18 like ETH) */
export const USDC_DECIMALS = 6

/**
 * Transfer USDC on Base Mainnet from the payer's wallet to a recipient.
 * The payer signs with their own private key — no platform wallet involved.
 *
 * @param toAddress - Recipient wallet address
 * @param amount - Human-readable USDC amount (e.g. "10.00")
 * @param payerPrivateKey - The payer's private key (used once, not stored)
 * @returns Transaction hash
 */
export async function transferUsdc(
  toAddress: `0x${string}`,
  amount: string,
  payerPrivateKey: `0x${string}`,
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(payerPrivateKey)

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  })

  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  })

  // Simulate first to catch errors before sending
  const { request } = await publicClient.simulateContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [toAddress, parseUnits(amount, USDC_DECIMALS)],
    account,
  })

  const txHash = await walletClient.writeContract(request)
  return txHash
}
