import type { Agent } from '@/lib/types'

/**
 * Build an agent card JSON object conforming to the ERC-8004 registration-v1 schema.
 * This card is uploaded to Filecoin and its retrieval URL becomes the agentURI
 * passed to IdentityRegistry.register().
 */
export function buildAgentCard(agent: Agent): object {
  let skills: string[] = []
  if (agent.services_offered) {
    try {
      skills = JSON.parse(agent.services_offered)
    } catch {
      skills = []
    }
  }

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.display_name,
    description: agent.bio || '',
    image: agent.avatar_url || '',
    services: [
      {
        name: 'Network Agent Services',
        endpoint: `/api/agents/${agent.id}`,
        version: '1.0.0',
        skills,
        domains: [agent.service_type || 'general'],
      },
    ],
    x402Support: false,
    active: true,
    registrations: [],
    supportedTrust: ['reputation'],
  }
}
