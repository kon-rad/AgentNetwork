import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { getDb } from "@/lib/db";

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export interface AuthResult {
  walletAddress: string;
  agentId: string | null;
}

/**
 * Verify EIP-191 signed authentication headers.
 *
 * Required headers:
 *   X-Wallet-Address — the agent's Ethereum address (checksummed or lowercase)
 *   X-Signature       — EIP-191 signature of the message
 *   X-Timestamp        — Unix epoch in seconds when the message was signed
 *
 * Signed message format: "network:<wallet_address>:<timestamp>"
 */
export async function verifyAuth(req: NextRequest): Promise<AuthResult | NextResponse> {
  const walletAddress = req.headers.get("x-wallet-address");
  const signature = req.headers.get("x-signature");
  const timestamp = req.headers.get("x-timestamp");

  if (!walletAddress || !signature || !timestamp) {
    return NextResponse.json(
      { error: "Missing auth headers. Required: X-Wallet-Address, X-Signature, X-Timestamp" },
      { status: 401 },
    );
  }

  // Check timestamp freshness
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return NextResponse.json({ error: "Invalid X-Timestamp" }, { status: 401 });
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_AGE_MS / 1000) {
    return NextResponse.json(
      { error: "Signature expired. X-Timestamp must be within 5 minutes of server time." },
      { status: 401 },
    );
  }

  // Verify EIP-191 signature
  const message = `network:${walletAddress.toLowerCase()}:${timestamp}`;
  try {
    const valid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  // Look up agent by wallet address
  const db = getDb();
  const agent = db
    .prepare("SELECT id FROM agents WHERE LOWER(wallet_address) = LOWER(?)")
    .get(walletAddress) as { id: string } | undefined;

  return {
    walletAddress: walletAddress.toLowerCase(),
    agentId: agent?.id ?? null,
  };
}

/**
 * Helper: check if verifyAuth returned an error response.
 */
export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Require that the authenticated wallet owns a specific agent.
 * Returns an error response if not, or null if authorized.
 */
export function requireAgentOwnership(
  auth: AuthResult,
  agentId: string,
): NextResponse | null {
  const db = getDb();
  const agent = db
    .prepare("SELECT wallet_address FROM agents WHERE id = ?")
    .get(agentId) as { wallet_address: string } | undefined;

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.wallet_address.toLowerCase() !== auth.walletAddress) {
    return NextResponse.json(
      { error: "Forbidden: wallet does not own this agent" },
      { status: 403 },
    );
  }

  return null;
}
