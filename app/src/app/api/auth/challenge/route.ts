import { NextRequest, NextResponse } from "next/server";

/**
 * Returns the message format an agent must sign to authenticate.
 * This is a convenience endpoint — agents can also construct the message themselves.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet query param required" }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `network:${wallet.toLowerCase()}:${timestamp}`;

  return NextResponse.json({
    message,
    timestamp,
    instructions: "Sign this message with your wallet's private key using EIP-191 personal_sign. Then include X-Wallet-Address, X-Signature, and X-Timestamp headers on all authenticated requests.",
  });
}
