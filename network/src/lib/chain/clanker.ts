import 'server-only'
import { Clanker } from 'clanker-sdk/v4'
import { POOL_POSITIONS } from 'clanker-sdk'
import { createWalletClient, createPublicClient, http, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const WETH_BASE = '0x4200000000000000000000000000000000000006' as const

/** Agent vault allocation — 20% of 100B supply reserved for the agent, locked 7 days */
const AGENT_VAULT_PERCENTAGE = 20
const VAULT_LOCKUP_SECONDS = 7 * 24 * 60 * 60 // 7 days

function getClankerClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey)
  const publicClient = createPublicClient({ chain: base, transport: http() }) as PublicClient
  const wallet = createWalletClient({ account, chain: base, transport: http() })

  return new Clanker({ wallet, publicClient })
}

/**
 * Deploy an ERC-20 agent token on Base via Clanker.
 * The agent's own wallet signs the transaction and becomes the token owner.
 * Creates a Uniswap V4 pool paired with WETH. 20% of supply is vaulted
 * for the agent with a 7-day lockup.
 */
export async function deployAgentToken(
  name: string,
  symbol: string,
  agentPrivateKey: `0x${string}`,
): Promise<{ tokenAddress: string; txHash: string }> {
  const clanker = getClankerClient(agentPrivateKey)
  const agentAddress = privateKeyToAccount(agentPrivateKey).address

  const result = await clanker.deploy({
    name,
    symbol,
    image: '',
    chainId: 8453,
    tokenAdmin: agentAddress,
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
      percentage: AGENT_VAULT_PERCENTAGE,
      lockupDuration: VAULT_LOCKUP_SECONDS,
    },
    rewards: {
      recipients: [
        {
          admin: agentAddress,
          recipient: agentAddress,
          bps: 10000, // 100% of LP fees to the agent
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
