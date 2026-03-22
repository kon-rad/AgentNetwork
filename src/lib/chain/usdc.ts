import 'server-only'
import { createWalletClient, createPublicClient, http, parseUnits, erc20Abi } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

/** USDC contract address on Base Sepolia */
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const

/** USDC uses 6 decimal places (not 18 like ETH) */
export const USDC_DECIMALS = 6

/**
 * Transfer USDC on Base Sepolia from the bounty payer wallet to a recipient.
 * Simulates the transaction first, then executes. Returns the tx hash.
 *
 * @param toAddress - Recipient wallet address
 * @param amount - Human-readable USDC amount (e.g. "10.00")
 * @returns Transaction hash
 */
export async function transferUsdc(
  toAddress: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const privateKey = process.env.BOUNTY_PAYER_PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    throw new Error('BOUNTY_PAYER_PRIVATE_KEY env var is required')
  }

  const account = privateKeyToAccount(privateKey)

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  })

  const publicClient = createPublicClient({
    chain: baseSepolia,
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
