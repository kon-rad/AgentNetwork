import { uploadToFilecoin } from '@/lib/chain/filecoin'
import { getDb } from '@/lib/db'
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

    const db = getDb()

    // For agent_card: check if this agent already has an agent_card upload (log replacement)
    if (uploadType === 'agent_card') {
      const existing = db
        .prepare(
          `SELECT id, piece_cid FROM filecoin_uploads WHERE agent_id = ? AND upload_type = 'agent_card' ORDER BY created_at DESC LIMIT 1`,
        )
        .get(agentId)
      if (existing) {
        console.log(
          `[filecoin] Replacing existing agent_card for agent ${agentId} (previous CID: ${(existing as { piece_cid: string }).piece_cid})`,
        )
      }
    }

    // Upload to Filecoin — may take seconds to minutes waiting for PDP proof confirmation
    const result = await uploadToFilecoin(data as object, fileName)

    const id = crypto.randomUUID()

    db.prepare(
      `INSERT INTO filecoin_uploads (id, agent_id, upload_type, piece_cid, retrieval_url, name)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, agentId, uploadType, result.pieceCid, result.retrievalUrl, fileName)

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
