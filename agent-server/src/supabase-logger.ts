// src/supabase-logger.ts
// Writes agent turn events to Supabase agent_events table.
// Guarded: if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing,
// logs a warning and all logEvent() calls become no-ops so agent turns never crash.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

let supabase: SupabaseClient | null = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  logger.info('[supabase-logger] initialized — agent_events logging enabled');
} else {
  logger.warn(
    '[supabase-logger] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — event logging disabled',
  );
}

export interface AgentEvent {
  agent_id: string;
  event_type: 'turn_start' | 'turn_complete' | 'tool_call' | 'llm_call' | 'error';
  payload: Record<string, unknown>;
  created_at?: string;
}

export async function logEvent(event: AgentEvent): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('agent_events').insert({
    ...event,
    created_at: event.created_at || new Date().toISOString(),
  });

  if (error) {
    // Log but never throw — observability failures must not crash agent turns (NC-03)
    logger.error({ err: error.message }, '[supabase-logger] insert error');
  }
}
