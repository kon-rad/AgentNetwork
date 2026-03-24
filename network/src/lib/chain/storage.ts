import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { FilecoinUploadResult } from '@/types/filecoin'

const STORAGE_MODE = process.env.AGENT_STORAGE_MODE || 'filecoin'

/**
 * Upload a JSON object to the configured storage backend.
 *
 * - "filecoin": uploads via Synapse SDK to Filecoin Onchain Cloud (requires FIL lockup)
 * - "database": stores JSON in the `agent_data_store` Supabase table (free, instant)
 *
 * Both modes return the same FilecoinUploadResult shape so callers are unchanged.
 */
export async function uploadData(
  data: object,
  name: string,
): Promise<FilecoinUploadResult> {
  if (STORAGE_MODE === 'database') {
    return uploadToDatabase(data, name)
  }
  // Default: filecoin
  const { uploadToFilecoin } = await import('@/lib/chain/filecoin')
  return uploadToFilecoin(data, name)
}

/**
 * Download previously-uploaded JSON content.
 *
 * - "filecoin": downloads by PieceCID via Synapse SDK
 * - "database": fetches by ID from `agent_data_store`
 */
export async function downloadData(idOrCid: string): Promise<object> {
  if (STORAGE_MODE === 'database') {
    return downloadFromDatabase(idOrCid)
  }
  const { downloadFromFilecoin } = await import('@/lib/chain/filecoin')
  return downloadFromFilecoin(idOrCid)
}

// ── Database storage backend ──────────────────────────────────────────

async function uploadToDatabase(
  data: object,
  name: string,
): Promise<FilecoinUploadResult> {
  const id = crypto.randomUUID()

  const { error } = await supabaseAdmin.from('agent_data_store').insert({
    id,
    name,
    data,
  })

  if (error) {
    throw new Error(`Database storage failed: ${error.message}`)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const retrievalUrl = `${appUrl}/api/chain/download/${id}`

  return {
    pieceCid: id,
    retrievalUrl,
    uploadType: 'agent_card',
    name,
  }
}

async function downloadFromDatabase(id: string): Promise<object> {
  const { data, error } = await supabaseAdmin
    .from('agent_data_store')
    .select('data')
    .eq('id', id)
    .single()

  if (error || !data) {
    throw new Error(`Content not found for ID: ${id}`)
  }

  return data.data as object
}
