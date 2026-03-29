/**
 * AgentKit proof signer for outbound requests.
 *
 * When a container agent needs to call an external AgentKit-protected service,
 * it sends a signing request to the credential proxy. This module recovers
 * the agent's private key from Supabase (via wallet-manager) and creates
 * a signed AgentKit proof that the container attaches to its outbound request.
 *
 * This keeps private keys out of containers — the same security boundary
 * used for wallet signing and Uniswap transactions.
 */

import crypto from 'crypto';
import { createWalletClient, http } from 'viem';
import { worldchain } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';
import { formatSIWEMessage } from '@worldcoin/agentkit';
import type { CompleteAgentkitInfo } from '@worldcoin/agentkit';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';

/**
 * Sign an AgentKit proof for an outbound request.
 *
 * Creates a SIWE-style message signed by the agent's wallet, which external
 * services verify via AgentBook to confirm the agent is human-backed.
 *
 * @param agentId - The agent whose wallet signs the proof
 * @param targetUrl - The URL being requested
 * @param method - HTTP method (GET, POST, etc.)
 * @returns Base64-encoded JSON proof string for the x-agentkit-proof header
 */
export async function signAgentkitProof(
  agentId: string,
  targetUrl: string,
  method: string,
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const walletKey = process.env.WALLET_ENCRYPTION_KEY;

  if (!supabaseUrl || !supabaseKey || !walletKey) {
    throw new Error('Supabase or wallet encryption not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Recover the agent's private key
  const { data, error } = await supabase
    .from('agent_wallet_keys')
    .select('encrypted_private_key, iv, auth_tag, wallet_address, agentbook_registered')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) {
    throw new Error(`No wallet found for agent ${agentId}`);
  }

  if (!data.agentbook_registered) {
    throw new Error(
      `Agent ${agentId} wallet is not registered in AgentBook. ` +
      `Run: npx @worldcoin/agentkit-cli register ${data.wallet_address}`
    );
  }

  // Decrypt the private key
  const encryptionKey = walletKey.length === 64
    ? Buffer.from(walletKey, 'hex')
    : crypto.createHash('sha256').update(walletKey).digest();

  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.auth_tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  let privateKey = decipher.update(data.encrypted_private_key, 'hex', 'utf8');
  privateKey += decipher.final('utf8');

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  // Build the AgentKit proof message
  const url = new URL(targetUrl);
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = new Date();

  const info: CompleteAgentkitInfo = {
    domain: url.hostname,
    uri: targetUrl,
    statement: `Agent ${agentId} requesting access`,
    version: '1',
    chainId: 'eip155:480', // World Chain
    type: 'eip191',
    nonce,
    issuedAt: now.toISOString(),
    expirationTime: new Date(now.getTime() + 5 * 60 * 1000).toISOString(), // 5 min expiry
  };

  // Format as SIWE message and sign
  const message = formatSIWEMessage(info, account.address);

  const walletClient = createWalletClient({
    account,
    chain: worldchain,
    transport: http(),
  });

  const signature = await walletClient.signMessage({ message });

  // Build the proof payload
  const payload = {
    ...info,
    address: account.address,
    signature,
  };

  // Encode as base64 JSON for the header
  const proof = Buffer.from(JSON.stringify(payload)).toString('base64');

  logger.info({ agentId, targetUrl, address: account.address }, '[agentkit-signer] proof signed');
  return proof;
}
