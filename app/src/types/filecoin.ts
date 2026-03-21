export type FilecoinUploadType = 'agent_card' | 'agent_log' | 'nft_metadata'

export interface FilecoinUploadResult {
  pieceCid: string
  retrievalUrl: string
  uploadType: FilecoinUploadType
  name: string
}

export interface FilecoinUploadRecord {
  id: string
  agent_id: string
  upload_type: FilecoinUploadType
  piece_cid: string
  retrieval_url: string
  name: string
  created_at: string
}
