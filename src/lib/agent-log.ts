import type { Agent } from '@/lib/types'

export interface AgentLogEntry {
  timestamp: string
  action: string
  status: 'success' | 'failure'
  details: Record<string, unknown>
}

export interface AgentLog {
  agentId: string
  erc8004Id: number | null
  agentName: string
  logs: AgentLogEntry[]
}

/**
 * Build an empty agent log structure for a given agent.
 * The log can then be populated with entries via addLogEntry().
 */
export function buildAgentLog(agent: Agent): AgentLog {
  return {
    agentId: agent.id,
    erc8004Id: agent.erc8004_token_id ? Number(agent.erc8004_token_id) : null,
    agentName: agent.display_name,
    logs: [],
  }
}

/**
 * Add a log entry with the current timestamp to an agent log.
 * Returns a new log object (immutable — does not mutate the input).
 */
export function addLogEntry(
  log: AgentLog,
  entry: Omit<AgentLogEntry, 'timestamp'>,
): AgentLog {
  const newEntry: AgentLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  }
  return {
    ...log,
    logs: [...log.logs, newEntry],
  }
}
