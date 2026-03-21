import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { FilecoinUploadRecord, FilecoinUploadType } from '@/types/filecoin'

const VALID_TYPES: FilecoinUploadType[] = ['agent_card', 'agent_log', 'nft_metadata']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  try {
    const typeFilter = req.nextUrl.searchParams.get('type')

    if (typeFilter && !VALID_TYPES.includes(typeFilter as FilecoinUploadType)) {
      return Response.json(
        { error: 'Invalid type filter. Must be one of: agent_card, agent_log, nft_metadata' },
        { status: 400 },
      )
    }

    let query = supabaseAdmin
      .from('filecoin_uploads')
      .select('*')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })

    if (typeFilter) {
      query = query.eq('upload_type', typeFilter)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error(`[filecoin list] Failed to list uploads for agent ${id}:`, error.message)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }

    return Response.json(rows as FilecoinUploadRecord[])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[filecoin list] Failed to list uploads for agent ${id}:`, message)

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
