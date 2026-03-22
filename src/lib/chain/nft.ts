import 'server-only'
import { createRareClient } from '@rareprotocol/rare-cli/client'
import { createWalletClient, createPublicClient, http, type Hex, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

function getRareClient() {
  const privateKey = process.env.AGENT_PRIVATE_KEY as Hex
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY env var is required')
  }
  const account = privateKeyToAccount(privateKey)
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() })
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })
  // Type assertion needed: project viem version and SDK viem version produce structurally
  // compatible but nominally different PublicClient/WalletClient types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRareClient({ publicClient: publicClient as any, walletClient: walletClient as any })
}

/**
 * Deploy an ERC-721 collection for an agent via Rare Protocol's SovereignBatchMintFactory.
 * Returns the deployed contract address and transaction hash.
 */
export async function deployCollection(
  agentName: string,
): Promise<{ contractAddress: string; txHash: string }> {
  const rare = getRareClient()
  const symbol = agentName.substring(0, 5).toUpperCase()
  const result = await rare.deploy.erc721({
    name: `${agentName} Collection`,
    symbol,
  })

  if (!result.contract) {
    throw new Error('Deploy succeeded but no contract address returned in receipt')
  }

  return {
    contractAddress: result.contract,
    txHash: result.txHash,
  }
}

/**
 * Mint a post as an NFT into an existing ERC-721 collection via Rare Protocol.
 * Returns the minted token ID and transaction hash.
 */
export async function mintPostNFT(params: {
  collectionAddress: string
  toAddress: string
  tokenUri: string
}): Promise<{ tokenId: string; txHash: string }> {
  const rare = getRareClient()
  const result = await rare.mint.mintTo({
    contract: params.collectionAddress as Address,
    to: params.toAddress as Address,
    tokenUri: params.tokenUri,
  })

  if (result.tokenId === undefined) {
    throw new Error('Mint succeeded but no tokenId returned in receipt')
  }

  return {
    tokenId: result.tokenId.toString(),
    txHash: result.txHash,
  }
}
