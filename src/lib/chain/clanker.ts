import 'server-only'
import { Clanker } from 'clanker-sdk/v4'
import { POOL_POSITIONS } from 'clanker-sdk'
import { createWalletClient, createPublicClient, http, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const WETH_BASE = '0x4200000000000000000000000000000000000006' as const

function getClankerClient() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY env var is required')
  }

  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: base, transport: http() }) as PublicClient
  const wallet = createWalletClient({ account, chain: base, transport: http() })

  return new Clanker({ wallet, publicClient })
}

function getDeployerAddress(): `0x${string}` {
  const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY env var is required')
  }
  return privateKeyToAccount(privateKey).address
}

/**
 * Deploy an ERC-20 agent token on Base via Clanker.
 * Creates the token with an automatic Uniswap V4 pool paired with WETH.
 */
export async function deployAgentToken(
  name: string,
  symbol: string,
): Promise<{ tokenAddress: string; txHash: string }> {
  const clanker = getClankerClient()
  const deployer = getDeployerAddress()

  const result = await clanker.deploy({
    name,
    symbol,
    image: '',
    chainId: 8453,
    tokenAdmin: deployer,
    metadata: {
      description: `${name} - Agent token on Network`,
    },
    context: {
      interface: 'Network',
      platform: 'Network',
      messageId: `deploy-${symbol}-${Date.now()}`,
      id: symbol,
    },
    pool: {
      pairedToken: WETH_BASE,
      positions: POOL_POSITIONS.Standard,
    },
    vault: {
      percentage: 0,
      lockupDuration: 7 * 24 * 60 * 60, // 7 days in seconds
    },
    rewards: {
      recipients: [
        {
          admin: deployer,
          recipient: deployer,
          bps: 10000, // 100%
          token: 'Both',
        },
      ],
    },
    vanity: false,
  })

  if (result.error) {
    throw new Error(`Clanker deploy failed: ${result.error.message ?? String(result.error)}`)
  }

  const txHash = result.txHash!
  const txResult = await result.waitForTransaction!()

  if (txResult.error) {
    throw new Error(`Clanker tx failed: ${txResult.error.message ?? String(txResult.error)}`)
  }

  return { tokenAddress: txResult.address!, txHash }
}

/**
 * Get a Uniswap swap URL for an agent token.
 */
export function getTokenSwapUrl(tokenAddress: string): string {
  return `https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${tokenAddress}&chain=base`
}

/**
 * Get a BaseScan URL for an agent token.
 */
export function getBaseScanTokenUrl(tokenAddress: string): string {
  return `https://basescan.org/token/${tokenAddress}`
}
