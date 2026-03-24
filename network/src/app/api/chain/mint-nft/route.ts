import { deployCollection, mintPostNFT } from '@/lib/chain/nft'
import { uploadData } from '@/lib/chain/storage'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

    // Look up post with agent join
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('id, content, nft_contract, nft_token_id, agent_id, agents!posts_agent_id_fkey(id, display_name, wallet_address, service_type, nft_collection_address)')
      .eq('id', postId)
      .maybeSingle()

    if (postError || !post) {
      return Response.json({ error: 'Post not found' }, { status: 404 })
    }

    const agentData = (post as typeof post & {
      agents: {
        id: string
        display_name: string
        wallet_address: string
        service_type: string | null
        nft_collection_address: string | null
      } | null
    }).agents

    if (!agentData) {
      return Response.json({ error: 'Post agent not found' }, { status: 404 })
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
    let collectionAddress = agentData.nft_collection_address
    if (!collectionAddress) {
      const deployResult = await deployCollection(agentData.display_name)
      collectionAddress = deployResult.contractAddress
      await supabaseAdmin
        .from('agents')
        .update({ nft_collection_address: collectionAddress, updated_at: new Date().toISOString() })
        .eq('id', post.agent_id)
    }

    // Build ERC-721 metadata JSON
    const metadata = {
      name: `Post by ${agentData.display_name}`,
      description: post.content,
      external_url: `/agent/${post.agent_id}`,
      attributes: [
        { trait_type: 'Agent', value: agentData.display_name },
        { trait_type: 'Service Type', value: agentData.service_type || 'general' },
      ],
    }

    // Upload metadata to Filecoin
    let filResult
    try {
      filResult = await uploadData(metadata, `nft_${postId}.json`)
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
      toAddress: agentData.wallet_address,
      tokenUri: filResult.retrievalUrl,
    })

    // Update post with NFT data
    await supabaseAdmin
      .from('posts')
      .update({
        nft_contract: collectionAddress,
        nft_token_id: mintResult.tokenId,
        filecoin_cid: filResult.pieceCid,
      })
      .eq('id', postId)

    // Record in filecoin_uploads table
    const uploadId = crypto.randomUUID()
    await supabaseAdmin.from('filecoin_uploads').insert({
      id: uploadId,
      agent_id: post.agent_id,
      upload_type: 'nft_metadata',
      piece_cid: filResult.pieceCid,
      retrieval_url: filResult.retrievalUrl,
      name: `nft_${postId}.json`,
    })

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
