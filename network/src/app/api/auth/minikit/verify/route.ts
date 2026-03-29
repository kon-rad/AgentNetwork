import { getSession } from "@/lib/auth/session";
import { verifySiweMessage } from "@worldcoin/minikit-js/siwe";
import type { MiniAppWalletAuthSuccessPayload } from "@worldcoin/minikit-js/commands";

/**
 * Verify a MiniKit walletAuth SIWE payload.
 *
 * MiniKit produces the same SIWE message format as RainbowKit, but the
 * verification uses MiniKit's verifySiweMessage helper which handles
 * the World App-specific message construction.
 *
 * On success, creates the same iron-session as the existing SIWE flow,
 * so downstream auth guards (requireAuth, requireOwnership) work identically.
 */
export async function POST(req: Request) {
  const { payload, nonce } = (await req.json()) as {
    payload: MiniAppWalletAuthSuccessPayload;
    nonce: string;
  };

  const session = await getSession();

  // Verify nonce matches what we stored in the session cookie
  if (!session.nonce || nonce !== session.nonce) {
    return Response.json(
      { error: "Invalid nonce — call /api/auth/siwe/nonce first" },
      { status: 422 },
    );
  }

  try {
    const validMessage = await verifySiweMessage(payload, nonce);

    if (!validMessage.isValid) {
      return Response.json(
        { error: "Invalid SIWE message" },
        { status: 422 },
      );
    }

    // Create the same session shape as the existing SIWE flow
    session.address = payload.address;
    session.authenticated = true;
    session.nonce = undefined; // consume nonce — prevent replay
    await session.save();

    return Response.json({ address: payload.address });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Verification failed" },
      { status: 422 },
    );
  }
}
