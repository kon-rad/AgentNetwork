import 'server-only'
import type { Agent } from '@/lib/types'
import { type AgentLog, addLogEntry } from '@/lib/agent-log'
import { buildAgentCard } from '@/lib/agent-card'
import { uploadToFilecoin } from '@/lib/chain/filecoin'
import { registerAgent } from '@/lib/chain/erc8004'
import { deployCollection, mintPostNFT } from '@/lib/chain/nft'
import { transferUsdc } from '@/lib/chain/usdc'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AgentScenario } from './demo-scenarios'

/**
 * Register an agent's on-chain identity via ERC-8004.
 * The agent's own wallet calls register() — they own the resulting NFT.
 * Idempotent: skips if agent already has an erc8004_token_id.
 */
export async function registerIdentityAction(
  agent: Agent,
  log: AgentLog,
  privateKey: `0x${string}`,
): Promise<AgentLog> {
  if (agent.erc8004_token_id) {
    return addLogEntry(log, {
      action: 'register_identity',
      status: 'success',
      details: { skipped: true, reason: 'already registered', tokenId: agent.erc8004_token_id },
    })
  }

  try {
    const card = buildAgentCard(agent)
    const filResult = await uploadToFilecoin(card, `agent_card_${agent.id}.json`)
    const { agentId, txHash } = await registerAgent(filResult.retrievalUrl, privateKey)

    await supabaseAdmin
      .from('agents')
      .update({ erc8004_token_id: agentId.toString(), updated_at: new Date().toISOString() })
      .eq('id', agent.id)

    return addLogEntry(log, {
      action: 'register_identity',
      status: 'success',
      details: { tokenId: agentId.toString(), txHash, agentCardUrl: filResult.retrievalUrl },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return addLogEntry(log, {
      action: 'register_identity',
      status: 'failure',
      details: { error: message },
    })
  }
}

/**
 * Create a bounty from the agent's scenario definition.
 * Idempotent: skips if a bounty with the same title already exists for this agent.
 */
export async function createBountyAction(
  agent: Agent,
  scenario: AgentScenario,
  log: AgentLog,
): Promise<AgentLog> {
  const { data: existing } = await supabaseAdmin
    .from('bounties')
    .select('id')
    .eq('creator_id', agent.id)
    .eq('title', scenario.bountyToCreate.title)
    .maybeSingle()

  if (existing) {
    return addLogEntry(log, {
      action: 'create_bounty',
      status: 'success',
      details: { skipped: true, reason: 'bounty already exists', bountyId: existing.id },
    })
  }

  try {
    const bountyId = crypto.randomUUID()
    await supabaseAdmin.from('bounties').insert({
      id: bountyId,
      creator_id: agent.id,
      creator_type: 'agent',
      title: scenario.bountyToCreate.title,
      description: scenario.bountyToCreate.description,
      reward_amount: scenario.bountyToCreate.reward_amount,
      reward_token: 'USDC',
      required_service_type: scenario.bountyToCreate.required_service_type,
      status: 'open',
    })

    return addLogEntry(log, {
      action: 'create_bounty',
      status: 'success',
      details: { bountyId, title: scenario.bountyToCreate.title },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return addLogEntry(log, {
      action: 'create_bounty',
      status: 'failure',
      details: { error: message },
    })
  }
}

/**
 * Discover an open bounty matching the agent's service type and claim it.
 * Returns the claimed bountyId or null if none found.
 */
export async function discoverAndClaimBounty(
  agent: Agent,
  log: AgentLog,
): Promise<{ log: AgentLog; bountyId: string | null }> {
  const { data: bounty } = await supabaseAdmin
    .from('bounties')
    .select('id')
    .eq('status', 'open')
    .eq('required_service_type', agent.service_type!)
    .neq('creator_id', agent.id)
    .limit(1)
    .maybeSingle()

  if (!bounty) {
    return {
      log: addLogEntry(log, {
        action: 'discover_bounty',
        status: 'success',
        details: { found: false, searchType: agent.service_type },
      }),
      bountyId: null,
    }
  }

  try {
    log = addLogEntry(log, {
      action: 'discover_bounty',
      status: 'success',
      details: { found: true, bountyId: bounty.id },
    })

    await supabaseAdmin
      .from('bounties')
      .update({ status: 'claimed', claimed_by: agent.id })
      .eq('id', bounty.id)

    log = addLogEntry(log, {
      action: 'claim_bounty',
      status: 'success',
      details: { bountyId: bounty.id },
    })

    return { log, bountyId: bounty.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      log: addLogEntry(log, {
        action: 'claim_bounty',
        status: 'failure',
        details: { bountyId: bounty.id, error: message },
      }),
      bountyId: null,
    }
  }
}

/**
 * Create a post for the agent with the given content.
 * Returns the new post ID.
 */
export async function createPostAction(
  agent: Agent,
  content: string,
  log: AgentLog,
): Promise<{ log: AgentLog; postId: string }> {
  const postId = crypto.randomUUID()

  try {
    await supabaseAdmin.from('posts').insert({
      id: postId,
      agent_id: agent.id,
      content,
      media_type: 'text',
    })

    return {
      log: addLogEntry(log, {
        action: 'create_post',
        status: 'success',
        details: { postId, contentPreview: content.substring(0, 80) },
      }),
      postId,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      log: addLogEntry(log, {
        action: 'create_post',
        status: 'failure',
        details: { error: message },
      }),
      postId,
    }
  }
}

/**
 * Mint a post as an NFT via Rare Protocol.
 * Auto-deploys collection if the agent doesn't have one yet.
 * Non-critical: failures are logged but do not block the demo flow.
 */
export async function mintPostNFTAction(
  agent: Agent,
  postId: string,
  log: AgentLog,
): Promise<AgentLog> {
  try {
    // Deploy collection if needed
    let collectionAddress = agent.nft_collection_address
    if (!collectionAddress) {
      const deployResult = await deployCollection(agent.display_name)
      collectionAddress = deployResult.contractAddress
      await supabaseAdmin
        .from('agents')
        .update({ nft_collection_address: collectionAddress, updated_at: new Date().toISOString() })
        .eq('id', agent.id)
    }

    // Build minimal metadata for the NFT
    const { data: postData } = await supabaseAdmin
      .from('posts')
      .select('content')
      .eq('id', postId)
      .maybeSingle()

    const metadata = {
      name: `Post by ${agent.display_name}`,
      description: postData?.content || '',
      external_url: `/agent/${agent.id}`,
      attributes: [
        { trait_type: 'Agent', value: agent.display_name },
        { trait_type: 'Service Type', value: agent.service_type || 'general' },
      ],
    }

    // Upload metadata to Filecoin
    const filResult = await uploadToFilecoin(metadata, `nft_${postId}.json`)

    // Mint NFT
    const mintResult = await mintPostNFT({
      collectionAddress,
      toAddress: agent.wallet_address,
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

    return addLogEntry(log, {
      action: 'mint_nft',
      status: 'success',
      details: { txHash: mintResult.txHash, tokenId: mintResult.tokenId, postId },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return addLogEntry(log, {
      action: 'mint_nft',
      status: 'failure',
      details: { error: message, postId },
    })
  }
}

/**
 * Complete a claimed bounty: optionally transfer USDC reward, then mark as completed.
 * The payerPrivateKey belongs to the bounty creator — they pay the agent directly.
 */
export async function completeBountyAction(
  agent: Agent,
  bountyId: string,
  log: AgentLog,
  payerPrivateKey?: `0x${string}`,
): Promise<AgentLog> {
  try {
    const { data: bountyData } = await supabaseAdmin
      .from('bounties')
      .select('*')
      .eq('id', bountyId)
      .maybeSingle()

    if (!bountyData || bountyData.status !== 'claimed' || bountyData.claimed_by !== agent.id) {
      return addLogEntry(log, {
        action: 'complete_bounty',
        status: 'failure',
        details: {
          bountyId,
          error: 'Bounty not found, not claimed, or claimed by different agent',
        },
      })
    }

    let txHash: string | null = null

    // Transfer USDC if reward is non-zero and payer key is provided
    if (bountyData.reward_amount && bountyData.reward_amount !== '0' && payerPrivateKey) {
      try {
        txHash = await transferUsdc(
          agent.wallet_address as `0x${string}`,
          bountyData.reward_amount,
          payerPrivateKey,
        )
      } catch (payErr) {
        const payMessage = payErr instanceof Error ? payErr.message : String(payErr)
        // Log payment failure but still complete the bounty
        log = addLogEntry(log, {
          action: 'complete_bounty_payment',
          status: 'failure',
          details: { bountyId, error: payMessage },
        })
      }
    }

    await supabaseAdmin
      .from('bounties')
      .update({
        status: 'completed',
        tx_hash: txHash,
        deliverable_url: 'Autonomous agent delivery',
        completed_at: new Date().toISOString(),
      })
      .eq('id', bountyId)

    return addLogEntry(log, {
      action: 'complete_bounty',
      status: 'success',
      details: { bountyId, txHash },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return addLogEntry(log, {
      action: 'complete_bounty',
      status: 'failure',
      details: { bountyId, error: message },
    })
  }
}

/**
 * Upload the agent's activity log to Filecoin for permanent storage.
 */
export async function uploadLogAction(
  log: AgentLog,
): Promise<{ log: AgentLog; pieceCid: string | null }> {
  try {
    const filResult = await uploadToFilecoin(log, `agent_log_${log.agentId}.json`)

    return {
      log: addLogEntry(log, {
        action: 'upload_log',
        status: 'success',
        details: { pieceCid: filResult.pieceCid },
      }),
      pieceCid: filResult.pieceCid,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      log: addLogEntry(log, {
        action: 'upload_log',
        status: 'failure',
        details: { error: message },
      }),
      pieceCid: null,
    }
  }
}
