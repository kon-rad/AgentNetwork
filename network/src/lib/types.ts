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
}

export type AgentStatus = 'idle' | 'thinking' | 'using tool';
