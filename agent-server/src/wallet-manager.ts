/**
 * Wallet manager for agent wallets.
 * Generates, encrypts, stores, and uses per-agent private keys.
 * Keys are AES-256-GCM encrypted at rest in Supabase; decrypted on-demand
 * within the credential proxy process only.
 */

import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createWalletClient,
  createPublicClient,
  http,
  type Hash,
  type TransactionRequest,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

let supabase: SupabaseClient | null = null;
let encryptionKey: Buffer | null = null;

/**
 * Initialize the wallet manager.
 * Must be called before any other functions.
 */
export function initWalletManager(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const walletKey = process.env.WALLET_ENCRYPTION_KEY;

  if (!url || !key) {
    logger.warn('[wallet-manager] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — disabled');
    return false;
  }

  if (!walletKey) {
    logger.warn('[wallet-manager] WALLET_ENCRYPTION_KEY not set — disabled');
    return false;
  }

  // Derive a 32-byte key from the env var (supports hex or arbitrary strings)
  encryptionKey = walletKey.length === 64
    ? Buffer.from(walletKey, 'hex')
    : crypto.createHash('sha256').update(walletKey).digest();

  supabase = createClient(url, key);
  logger.info('[wallet-manager] initialized');
  return true;
}

function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  if (!encryptionKey) throw new Error('Wallet manager not initialized');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), authTag };
}

function decrypt(encrypted: string, ivHex: string, authTagHex: string): string {
  if (!encryptionKey) throw new Error('Wallet manager not initialized');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate a new wallet for an agent and store the encrypted key.
 * Returns the wallet address.
 */
export async function createAgentWallet(agentId: string): Promise<string> {
  if (!supabase) throw new Error('Wallet manager not initialized');

  // Check if wallet already exists
  const { data: existing } = await supabase
    .from('agent_wallet_keys')
    .select('wallet_address')
    .eq('agent_id', agentId)
    .single();

  if (existing) {
    logger.info({ agentId, address: existing.wallet_address }, '[wallet-manager] wallet already exists');
    return existing.wallet_address;
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const { encrypted, iv, authTag } = encrypt(privateKey);

  const { error } = await supabase.from('agent_wallet_keys').insert({
    agent_id: agentId,
    encrypted_private_key: encrypted,
    iv,
    auth_tag: authTag,
    wallet_address: account.address,
  });

  if (error) throw new Error(`Failed to store wallet key: ${error.message}`);

  logger.info({ agentId, address: account.address }, '[wallet-manager] wallet created');
  return account.address;
}

/**
 * Get the wallet address for an agent.
 */
export async function getAgentAddress(agentId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('agent_wallet_keys')
    .select('wallet_address')
    .eq('agent_id', agentId)
    .single();

  return data?.wallet_address ?? null;
}

/** Recover the viem account for an agent (internal use). */
async function getAgentAccount(agentId: string) {
  if (!supabase) throw new Error('Wallet manager not initialized');

  const { data, error } = await supabase
    .from('agent_wallet_keys')
    .select('encrypted_private_key, iv, auth_tag')
    .eq('agent_id', agentId)
    .single();

  if (error || !data) throw new Error(`No wallet found for agent ${agentId}`);

  const privateKey = decrypt(data.encrypted_private_key, data.iv, data.auth_tag) as `0x${string}`;
  return privateKeyToAccount(privateKey);
}

/**
 * Sign and broadcast a transaction from the agent's wallet.
 */
export async function sendTransaction(
  agentId: string,
  tx: { to: string; data?: string; value?: string },
): Promise<{ txHash: Hash }> {
  const account = await getAgentAccount(agentId);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  // Estimate gas and get nonce
  const txRequest: TransactionRequest = {
    to: tx.to as `0x${string}`,
    data: (tx.data || '0x') as `0x${string}`,
    value: tx.value ? BigInt(tx.value) : 0n,
  };

  const gasEstimate = await publicClient.estimateGas({
    ...txRequest,
    account,
  });

  const txHash = await walletClient.sendTransaction({
    ...txRequest,
    gas: gasEstimate,
  });

  logger.info({ agentId, txHash }, '[wallet-manager] transaction sent');
  return { txHash };
}

/**
 * Sign EIP-712 typed data (used for Permit2 signatures).
 */
export async function signTypedData(
  agentId: string,
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  },
): Promise<{ signature: Hash }> {
  const account = await getAgentAccount(agentId);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  const signature = await walletClient.signTypedData({
    domain: typedData.domain as any,
    types: typedData.types as any,
    primaryType: typedData.primaryType,
    message: typedData.message as any,
  });

  logger.info({ agentId }, '[wallet-manager] typed data signed');
  return { signature };
}
