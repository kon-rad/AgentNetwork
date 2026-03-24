import { uploadData } from '@/lib/chain/storage'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { FilecoinUploadType } from '@/types/filecoin'

const VALID_TYPES: FilecoinUploadType[] = ['agent_card', 'agent_log', 'nft_metadata']

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { type, agentId, data, name } = body as {
      type: unknown
      agentId: unknown
      data: unknown
      name?: unknown
    }

    // Validate type
    if (!type || !VALID_TYPES.includes(type as FilecoinUploadType)) {
      return Response.json(
        { error: 'Invalid type. Must be one of: agent_card, agent_log, nft_metadata' },
        { status: 400 },
      )
    }

    // Validate agentId
    if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
      return Response.json(
        { error: 'agentId is required and must be a non-empty string' },
        { status: 400 },
      )
    }

    // Validate data
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return Response.json(
        { error: 'data is required and must be a non-null object' },
        { status: 400 },
      )
    }

    const uploadType = type as FilecoinUploadType
    const fileName =
      name && typeof name === 'string' ? name : `${uploadType}_${agentId}.json`

    // For agent_card: check if this agent already has an agent_card upload (log replacement)
    if (uploadType === 'agent_card') {
      const { data: existing } = await supabaseAdmin
        .from('filecoin_uploads')
        .select('piece_cid')
        .eq('agent_id', agentId)
        .eq('upload_type', 'agent_card')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        console.log(
          `[filecoin] Replacing existing agent_card for agent ${agentId} (previous CID: ${existing.piece_cid})`,
        )
      }
    }

    // Upload to Filecoin — may take seconds to minutes waiting for PDP proof confirmation
    const result = await uploadData(data as object, fileName)

    const id = crypto.randomUUID()

    const { error: insertError } = await supabaseAdmin.from('filecoin_uploads').insert({
      id,
      agent_id: agentId,
      upload_type: uploadType,
      piece_cid: result.pieceCid,
      retrieval_url: result.retrievalUrl,
      name: fileName,
    })

    if (insertError) {
      console.error('[filecoin upload] DB insert error:', insertError.message)
      return Response.json({ error: 'Failed to record upload', details: insertError.message }, { status: 500 })
    }

    return Response.json(
      {
        pieceCid: result.pieceCid,
        retrievalUrl: result.retrievalUrl,
        uploadType,
        agentId,
        id,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // SDK / payment / upload failures
    if (
      message.includes('upload') ||
      message.includes('payment') ||
      message.includes('Filecoin') ||
      message.includes('PieceCID')
    ) {
      return Response.json(
        { error: 'Filecoin upload failed', details: message },
        { status: 502 },
      )
    }

    console.error('[filecoin upload] Unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
