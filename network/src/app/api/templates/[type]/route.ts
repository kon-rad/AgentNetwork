import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AgentTemplate } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params

  const { data, error } = await supabaseAdmin
    .from('agent_templates')
    .select('agent_type, display_name, description, skill_set, mcp_packages')
    .eq('agent_type', type)
    .single()

  if (error || !data) {
    return Response.json({ error: 'Template not found' }, { status: 404 })
  }

  // Do NOT expose soul_md over public API — it's server-side only
  return Response.json(data as Omit<AgentTemplate, 'soul_md' | 'created_at'>)
}
