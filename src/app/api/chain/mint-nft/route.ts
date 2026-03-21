import { deployCollection, mintPostNFT } from '@/lib/chain/nft'
import { uploadToFilecoin } from '@/lib/chain/filecoin'
import { getDb } from '@/lib/db'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { postId } = body as { postId: unknown }

    if (!postId || typeof postId !== 'string' || postId.trim() === '') {
      return Response.json(
        { error: 'postId is required and must be a non-empty string' },
        { status: 400 },
      )
    }

    const db = getDb()

    // Look up post with agent join
    const post = db
      .prepare(
        `SELECT p.id, p.content, p.nft_contract, p.nft_token_id, p.agent_id,
                a.id AS agent_id_joined, a.display_name, a.wallet_address,
                a.service_type, a.nft_collection_address
         FROM posts p
         JOIN agents a ON p.agent_id = a.id
         WHERE p.id = ?`,
      )
      .get(postId) as
      | {
          id: string
          content: string
          nft_contract: string | null
          nft_token_id: string | null
          agent_id: string
          agent_id_joined: string
          display_name: string
          wallet_address: string
          service_type: string | null
          nft_collection_address: string | null
        }
      | undefined

    if (!post) {
      return Response.json({ error: 'Post not found' }, { status: 404 })
    }

    // Idempotent: if post already has an NFT, return existing data
    if (post.nft_contract) {
      return Response.json(
        {
          nftContract: post.nft_contract,
          tokenId: post.nft_token_id,
          existing: true,
        },
        { status: 200 },
      )
    }

    // Deploy collection if agent doesn't have one yet
    let collectionAddress = post.nft_collection_address
    if (!collectionAddress) {
      const deployResult = await deployCollection(post.display_name)
      collectionAddress = deployResult.contractAddress
      db.prepare('UPDATE agents SET nft_collection_address = ?, updated_at = datetime(?) WHERE id = ?')
        .run(collectionAddress, new Date().toISOString(), post.agent_id)
    }

    // Build ERC-721 metadata JSON
    const metadata = {
      name: `Post by ${post.display_name}`,
      description: post.content,
      external_url: `/agent/${post.agent_id}`,
      attributes: [
        { trait_type: 'Agent', value: post.display_name },
        { trait_type: 'Service Type', value: post.service_type || 'general' },
      ],
    }

    // Upload metadata to Filecoin
    let filResult
    try {
      filResult = await uploadToFilecoin(metadata, `nft_${postId}.json`)
    } catch (filErr) {
      const filMessage = filErr instanceof Error ? filErr.message : String(filErr)
      console.error('[mint-nft] Filecoin upload failed:', filErr)
      return Response.json(
        { error: 'Filecoin metadata upload failed', details: filMessage },
        { status: 502 },
      )
    }

    // Mint NFT with tokenURI pointing to Filecoin CDN retrieval URL
    const mintResult = await mintPostNFT({
      collectionAddress,
      toAddress: post.wallet_address,
      tokenUri: filResult.retrievalUrl,
    })

    // Update post with NFT data
    db.prepare(
      'UPDATE posts SET nft_contract = ?, nft_token_id = ?, filecoin_cid = ? WHERE id = ?',
    ).run(collectionAddress, mintResult.tokenId, filResult.pieceCid, postId)

    // Record in filecoin_uploads table
    const uploadId = crypto.randomUUID()
    db.prepare(
      `INSERT INTO filecoin_uploads (id, agent_id, upload_type, piece_cid, retrieval_url, name)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      uploadId,
      post.agent_id,
      'nft_metadata',
      filResult.pieceCid,
      filResult.retrievalUrl,
      `nft_${postId}.json`,
    )

    return Response.json(
      {
        nftContract: collectionAddress,
        tokenId: mintResult.tokenId,
        txHash: mintResult.txHash,
        filecoinCid: filResult.pieceCid,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[mint-nft] Error:', err)
    return Response.json(
      { error: 'NFT minting failed', details: message },
      { status: 502 },
    )
  }
}
