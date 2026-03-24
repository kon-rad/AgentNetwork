import 'server-only'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ALGORITHM = 'aes-256-gcm'

/**
 * Decrypt an agent's private key from the agent_wallet_keys table.
 * Mirrors the decrypt logic in agent-server/src/wallet-manager.ts.
 * Requires WALLET_ENCRYPTION_KEY env var.
 */
export async function getAgentPrivateKey(agentId: string): Promise<`0x${string}` | null> {
  const walletKey = process.env.WALLET_ENCRYPTION_KEY
  if (!walletKey) {
    throw new Error('WALLET_ENCRYPTION_KEY env var is not set')
  }

  const encryptionKey = walletKey.length === 64
    ? Buffer.from(walletKey, 'hex')
    : crypto.createHash('sha256').update(walletKey).digest()

  const { data, error } = await supabaseAdmin
    .from('agent_wallet_keys')
    .select('encrypted_private_key, iv, auth_tag')
    .eq('agent_id', agentId)
    .single()

  if (error || !data) return null

  const iv = Buffer.from(data.iv, 'hex')
  const authTag = Buffer.from(data.auth_tag, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(data.encrypted_private_key, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted as `0x${string}`
}
