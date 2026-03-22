import 'server-only'
import type { Agent } from '@/lib/types'
import { buildAgentLog } from '@/lib/agent-log'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  registerIdentityAction,
  createBountyAction,
  discoverAndClaimBounty,
  createPostAction,
  mintPostNFTAction,
  completeBountyAction,
  uploadLogAction,
} from '@/lib/autonomous/agent-actions'
import { AGENT_SCENARIOS } from '@/lib/autonomous/demo-scenarios'

export interface RunResult {
  agentId: string
  agentName: string
  serviceType: string
  actions: { action: string; status: 'success' | 'failure'; details: Record<string, unknown> }[]
  logFilecoinCid: string | null
}

let lastRunResults: RunResult[] | null = null

export function getLastRunResults(): RunResult[] | null {
  return lastRunResults
}

/**
 * Validate that required environment variables are set before running the loop.
 * Throws a descriptive error listing which variables are missing.
 */
function validateEnvironment(): void {
  const required = ['FILECOIN_PRIVATE_KEY', 'AGENT_PAYMENT_ADDRESS']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Set these before running the autonomous loop.`,
    )
  }
}

/**
 * Run the full autonomous agent loop.
 * Executes all agents sequentially, each going through the complete action pipeline.
 * Per-agent try/catch prevents cascading failures.
 */
export async function runAutonomousLoop(): Promise<RunResult[]> {
  validateEnvironment()

  const { data: agentsData } = await supabaseAdmin.from('agents').select('*')
  const agents = (agentsData || []) as Agent[]

  const results: RunResult[] = []

  for (const agent of agents) {
    try {
      let log = buildAgentLog(agent)
      const scenario = AGENT_SCENARIOS[agent.service_type || 'general'] || AGENT_SCENARIOS.general

      // Step 1: Register identity (idempotent)
      // Use FILECOIN_PRIVATE_KEY as the signing key for demo agent registrations
      const privateKey = (process.env.FILECOIN_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001') as `0x${string}`
      log = await registerIdentityAction(agent, log, privateKey)

      // Re-read agent from DB after registration (may have updated erc8004_token_id)
      const { data: freshAgentData } = await supabaseAdmin
        .from('agents')
        .select('*')
        .eq('id', agent.id)
        .single()
      const freshAgent = freshAgentData as Agent

      // Step 2: Create bounty for other agents
      log = await createBountyAction(freshAgent, scenario, log)

      // Step 3: Discover and claim a matching bounty
      const claimResult = await discoverAndClaimBounty(freshAgent, log)
      log = claimResult.log
      const bountyId = claimResult.bountyId

      // Step 4: Create a post with the first scenario post content
      const postResult = await createPostAction(freshAgent, scenario.posts[0], log)
      log = postResult.log
      const postId = postResult.postId

      // Step 5: Mint post as NFT
      log = await mintPostNFTAction(freshAgent, postId, log)

      // Step 6: Complete claimed bounty if one was found
      if (bountyId) {
        log = await completeBountyAction(freshAgent, bountyId, log)
      }

      // Step 7: Upload activity log to Filecoin
      const uploadResult = await uploadLogAction(log)
      log = uploadResult.log

      // Build RunResult from log entries
      results.push({
        agentId: freshAgent.id,
        agentName: freshAgent.display_name,
        serviceType: freshAgent.service_type || 'general',
        actions: log.logs.map((entry) => ({
          action: entry.action,
          status: entry.status,
          details: entry.details,
        })),
        logFilecoinCid: uploadResult.pieceCid,
      })
    } catch (err) {
      // Per-agent failure: attempt to upload partial log, then continue
      const message = err instanceof Error ? err.message : String(err)
      let errorLog = buildAgentLog(agent)
      const { addLogEntry } = await import('@/lib/agent-log')
      errorLog = addLogEntry(errorLog, {
        action: 'agent_loop_error',
        status: 'failure',
        details: { error: message },
      })

      // Attempt partial log upload
      let logCid: string | null = null
      try {
        const uploadResult = await uploadLogAction(errorLog)
        errorLog = uploadResult.log
        logCid = uploadResult.pieceCid
      } catch {
        // Upload also failed; continue with null CID
      }

      results.push({
        agentId: agent.id,
        agentName: agent.display_name,
        serviceType: agent.service_type || 'general',
        actions: errorLog.logs.map((entry) => ({
          action: entry.action,
          status: entry.status,
          details: entry.details,
        })),
        logFilecoinCid: logCid,
      })
    }
  }

  lastRunResults = results
  return results
}
