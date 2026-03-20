import 'server-only'
import { Synapse, getChain } from '@filoz/synapse-sdk'
import { createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { FilecoinUploadResult } from '@/types/filecoin'

// Filecoin chain IDs — NOT EVM Base chain IDs (8453)
// Mainnet: 314 | Calibration testnet: 314159
const CHAIN_ID = process.env.FILECOIN_NETWORK === 'mainnet' ? 314 : 314159

let _synapse: Synapse | null = null

async function getSynapse(): Promise<Synapse> {
  if (_synapse) return _synapse

  const privateKey = process.env.FILECOIN_PRIVATE_KEY as Hex
  if (!privateKey) {
    throw new Error('FILECOIN_PRIVATE_KEY env var is required')
  }

  const chain = getChain(CHAIN_ID)
  const account = privateKeyToAccount(privateKey)
  const client = createWalletClient({ account, chain, transport: http() })

  // source: null means no referral tracking — required by SynapseFromClientOptions
  _synapse = new Synapse({ client, source: null })
  return _synapse
}

/**
 * Upload a JSON object to Filecoin Onchain Cloud.
 * Returns only after onPiecesConfirmed — when PDP proof is verified on-chain
 * and the data is reliably retrievable. This may take seconds to minutes.
 */
export async function uploadToFilecoin(
  data: object,
  name: string,
): Promise<FilecoinUploadResult> {
  const synapse = await getSynapse()
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2))

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })

  const context = await synapse.storage.createContext({ withCDN: true })

  // Wait for onPiecesConfirmed — means PDP proof is on-chain and data is retrievable.
  // Do NOT use onStored as the "done" signal — retrieval is not guaranteed at that point.
  let resolvedCid: string | undefined

  await new Promise<void>((resolve, reject) => {
    context
      .upload(stream, {
        pieceMetadata: { name },
        onPiecesConfirmed(_dataSetId, _providerId, pieces) {
          resolvedCid = pieces[0]?.pieceCid?.toString()
          resolve()
        },
      })
      .catch(reject)
  })

  if (!resolvedCid) {
    throw new Error(`Filecoin upload failed: no PieceCID returned for "${name}"`)
  }

  return {
    pieceCid: resolvedCid,
    retrievalUrl: `https://cdn.filecoin.cloud/${resolvedCid}`,
    // uploadType and name are set by the caller when persisting to DB
    uploadType: 'agent_card',
    name,
  }
}

/**
 * Download previously-uploaded JSON content by PieceCID.
 * Note: data may not be immediately retrievable after upload — wait for
 * onPiecesConfirmed before attempting download.
 */
export async function downloadFromFilecoin(pieceCid: string): Promise<object> {
  const synapse = await getSynapse()
  const data = await synapse.storage.download({ pieceCid })
  const text = new TextDecoder().decode(data)
  return JSON.parse(text)
}
