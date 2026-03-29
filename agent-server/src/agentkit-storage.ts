/**
 * AgentKit storage adapter backed by Supabase.
 *
 * Implements the AgentKitStorage interface from @worldcoin/agentkit,
 * persisting usage counters and nonces in Supabase Postgres.
 * This ensures data survives agent-server redeployments (unlike SQLite
 * or in-memory storage) and stays consistent with other agent data
 * already in Supabase (wallet keys, trades, holdings).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AgentKitStorage } from '@worldcoin/agentkit';
import { logger } from './logger.js';

export class SupabaseAgentKitStorage implements AgentKitStorage {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Atomically increment usage if under the limit.
   * Uses Postgres upsert with a conditional update to prevent TOCTOU races.
   */
  async tryIncrementUsage(endpoint: string, humanId: string, limit: number): Promise<boolean> {
    // Try to upsert: insert with count=1, or increment if under limit
    const { data, error } = await this.supabase.rpc('agentkit_try_increment_usage', {
      p_endpoint: endpoint,
      p_human_id: humanId,
      p_limit: limit,
    });

    if (error) {
      logger.error({ error, endpoint, humanId }, '[agentkit-storage] tryIncrementUsage failed');
      // Fail closed — deny access if we can't check
      return false;
    }

    return data === true;
  }

  async hasUsedNonce(nonce: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('agentkit_nonces')
      .select('nonce')
      .eq('nonce', nonce)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = "not found" which is expected
      logger.error({ error, nonce }, '[agentkit-storage] hasUsedNonce failed');
    }

    return !!data;
  }

  async recordNonce(nonce: string): Promise<void> {
    const { error } = await this.supabase
      .from('agentkit_nonces')
      .insert({ nonce });

    if (error) {
      logger.error({ error, nonce }, '[agentkit-storage] recordNonce failed');
    }
  }
}
