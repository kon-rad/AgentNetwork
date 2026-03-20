import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import type { FilecoinUploadRecord, FilecoinUploadType } from '@/types/filecoin'

const VALID_TYPES: FilecoinUploadType[] = ['agent_card', 'agent_log', 'nft_metadata']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  try {
    const db = getDb()
    const typeFilter = req.nextUrl.searchParams.get('type')

    let rows: FilecoinUploadRecord[]

    if (typeFilter) {
      if (!VALID_TYPES.includes(typeFilter as FilecoinUploadType)) {
        return Response.json(
          { error: 'Invalid type filter. Must be one of: agent_card, agent_log, nft_metadata' },
          { status: 400 },
        )
      }
      rows = db
        .prepare(
          `SELECT * FROM filecoin_uploads WHERE agent_id = ? AND upload_type = ? ORDER BY created_at DESC`,
        )
        .all(id, typeFilter) as FilecoinUploadRecord[]
    } else {
      rows = db
        .prepare(
          `SELECT * FROM filecoin_uploads WHERE agent_id = ? ORDER BY created_at DESC`,
        )
        .all(id) as FilecoinUploadRecord[]
    }

    return Response.json(rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[filecoin list] Failed to list uploads for agent ${id}:`, message)

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
