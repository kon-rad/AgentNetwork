export interface Agent {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  service_type: string | null;
  services_offered: string | null; // JSON string
  ens_name: string | null;
  wallet_address: string;
  owner_wallet?: string | null;
  erc8004_token_id: string | null;
  token_address: string | null;
  token_symbol: string | null;
  nft_collection_address: string | null;
  self_verified: number;
  world_id_verified?: boolean;
  world_id_verification_level?: string | null;
  follower_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  agent_id: string;
  content: string;
  media_urls: string | null;
  media_type: string;
  nft_contract: string | null;
  nft_token_id: string | null;
  filecoin_cid: string | null;
  like_count: number;
  repost_count: number;
  created_at: string;
  // Joined fields
  agent_display_name?: string;
  agent_avatar_url?: string | null;
  agent_service_type?: string | null;
}

export interface Follow {
  follower_id: string;
  follower_type: string;
  following_id: string;
  created_at: string;
}

export interface Bounty {
  id: string;
  creator_id: string;
  creator_type: string;
  title: string;
  description: string;
  reward_amount: string | null;
  reward_token: string | null;
  status: string;
  claimed_by: string | null;
  required_service_type: string | null;
  deliverable_url: string | null;
  tx_hash: string | null;
  created_at: string;
  completed_at: string | null;
  // Joined fields
  creator_display_name?: string;
  claimed_by_display_name?: string;
}

export interface Service {
  id: string;
  agent_id: string;
  title: string;
  description: string;
  price: string | null;
  price_token: string;
  delivery_time: string | null;
  category: string | null;
  examples: string | null; // JSON string array
  requirements: string | null; // JSON string array
  created_at: string;
  updated_at: string;
  // Joined fields
  agent_display_name?: string;
  agent_avatar_url?: string | null;
  agent_service_type?: string | null;
  agent_wallet_address?: string;
  agent_erc8004_token_id?: string | null;
}

export const SERVICE_TYPES = [
  "filmmaker",
  "coder",
  "auditor",
  "trader",
  "clipper",
  "curator",
  "designer",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export type SubscriptionStatus = 'active' | 'expired' | 'pending';

export interface Subscription {
  id: string;
  owner_wallet: string;
  agent_id: string;
  tx_hash: string;
  amount_usdc: number;
  activated_at: string;   // ISO timestamptz
  expires_at: string;     // ISO timestamptz
  status: SubscriptionStatus;
}

export interface ServicePayment {
  id: string;
  service_id: string;
  agent_id: string;
  payer_address: string;
  tx_hash: string | null;
  amount: string;
  token: string;
  network: string;
  status: 'confirmed' | 'pending' | 'failed';
  created_at: string;
  // Joined fields
  payer_display_name?: string;
  service_title?: string;
}

export interface AgentTemplate {
  agent_type: string;        // 'filmmaker' | 'coder' | 'trader' | 'auditor' | 'clipper'
  display_name: string;
  description: string;
  soul_md: string;
  skill_set: string[];
  mcp_packages: string[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  agent_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  session_id?: string | null;
}

export interface ChatSession {
  id: string;
  agent_id: string;
  title: string | null;
  nanoclaw_session_id: string | null;
  created_at: string;
  last_message_at: string;
}

export interface AgentTrade {
  id: string;
  agent_id: string;
  tx_hash: string | null;
  token_in_address: string;
  token_out_address: string;
  token_in_symbol: string | null;
  token_out_symbol: string | null;
  amount_in: string;
  amount_out: string;
  amount_in_formatted: string | null;
  amount_out_formatted: string | null;
  price_impact: string | null;
  gas_fee: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  chain_id: number;
  created_at: string;
}

export interface AgentTokenHolding {
  id: string;
  agent_id: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  decimals: number;
  balance: string;
  balance_formatted: string | null;
  last_updated: string;
}

export type AgentStatus = 'idle' | 'thinking' | 'using tool';

export interface AgentEvent {
  id: string;
  agent_id: string;
  event_type: 'turn_start' | 'turn_complete' | 'tool_call' | 'llm_call' | 'error';
  payload: Record<string, unknown>;
  created_at: string;
}
