import 'server-only'
import type { Agent } from '@/lib/types'
import { type AgentLog, addLogEntry } from '@/lib/agent-log'
import { buildAgentCard } from '@/lib/agent-card'
import { uploadToFilecoin } from '@/lib/chain/filecoin'
import { registerAgent } from '@/lib/chain/erc8004'
import { deployCollection, mintPostNFT } from '@/lib/chain/nft'
import { transferUsdc } from '@/lib/chain/usdc'
import { getDb } from '@/lib/db'
import type { AgentScenario } from './demo-scenarios'

/**
 * Register an agent's on-chain identity via ERC-8004.
 * Idempotent: skips if agent already has an erc8004_token_id.
 */
export async function registerIdentityAction(
  agent: Agent,
  log: AgentLog,
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
    const { agentId, txHash } = await registerAgent(filResult.retrievalUrl)

    const db = getDb()
    db.prepare('UPDATE agents SET erc8004_token_id = ?, updated_at = datetime(?) WHERE id = ?')
      .run(agentId.toString(), new Date().toISOString(), agent.id)

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
  const db = getDb()

  const existing = db
    .prepare('SELECT id FROM bounties WHERE creator_id = ? AND title = ?')
    .get(agent.id, scenario.bountyToCreate.title) as { id: string } | undefined

  if (existing) {
    return addLogEntry(log, {
      action: 'create_bounty',
      status: 'success',
      details: { skipped: true, reason: 'bounty already exists', bountyId: existing.id },
    })
  }

  try {
    const bountyId = crypto.randomUUID()
    db.prepare(
      `INSERT INTO bounties (id, creator_id, creator_type, title, description, reward_amount, reward_token, required_service_type, status)
       VALUES (?, ?, 'agent', ?, ?, ?, 'USDC', ?, 'open')`,
    ).run(
      bountyId,
      agent.id,
      scenario.bountyToCreate.title,
      scenario.bountyToCreate.description,
      scenario.bountyToCreate.reward_amount,
      scenario.bountyToCreate.required_service_type,
    )

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
  const db = getDb()

  const bounty = db
    .prepare(
      'SELECT id FROM bounties WHERE status = ? AND required_service_type = ? AND creator_id != ? LIMIT 1',
    )
    .get('open', agent.service_type, agent.id) as { id: string } | undefined

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

    db.prepare('UPDATE bounties SET status = ?, claimed_by = ? WHERE id = ?')
      .run('claimed', agent.id, bounty.id)

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
  const db = getDb()
  const postId = crypto.randomUUID()

  try {
    db.prepare(
      `INSERT INTO posts (id, agent_id, content, media_type) VALUES (?, ?, ?, 'text')`,
    ).run(postId, agent.id, content)

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
    const db = getDb()

    // Deploy collection if needed
    let collectionAddress = agent.nft_collection_address
    if (!collectionAddress) {
      const deployResult = await deployCollection(agent.display_name)
      collectionAddress = deployResult.contractAddress
      db.prepare('UPDATE agents SET nft_collection_address = ?, updated_at = datetime(?) WHERE id = ?')
        .run(collectionAddress, new Date().toISOString(), agent.id)
    }

    // Build minimal metadata for the NFT
    const post = db.prepare('SELECT content FROM posts WHERE id = ?').get(postId) as
      | { content: string }
      | undefined

    const metadata = {
      name: `Post by ${agent.display_name}`,
      description: post?.content || '',
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
    db.prepare('UPDATE posts SET nft_contract = ?, nft_token_id = ?, filecoin_cid = ? WHERE id = ?')
      .run(collectionAddress, mintResult.tokenId, filResult.pieceCid, postId)

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
 */
export async function completeBountyAction(
  agent: Agent,
  bountyId: string,
  log: AgentLog,
): Promise<AgentLog> {
  const db = getDb()

  try {
    const bounty = db.prepare('SELECT * FROM bounties WHERE id = ?').get(bountyId) as
      | { id: string; status: string; claimed_by: string | null; reward_amount: string | null }
      | undefined

    if (!bounty || bounty.status !== 'claimed' || bounty.claimed_by !== agent.id) {
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

    // Transfer USDC if reward is non-zero
    if (bounty.reward_amount && bounty.reward_amount !== '0') {
      try {
        txHash = await transferUsdc(
          agent.wallet_address as `0x${string}`,
          bounty.reward_amount,
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

    db.prepare(
      `UPDATE bounties SET status = 'completed', tx_hash = ?, deliverable_url = 'Autonomous agent delivery', completed_at = datetime(?) WHERE id = ?`,
    ).run(txHash, new Date().toISOString(), bountyId)

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
