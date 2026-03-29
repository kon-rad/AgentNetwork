import { signRequest } from "@worldcoin/idkit/signing";

/**
 * Sign an RP request for World ID verification.
 *
 * The frontend needs an RP signature to construct a proof request
 * that the World App can verify. This endpoint generates a fresh
 * signature using the RP signing key from the Developer Portal.
 */
export async function POST(req: Request) {
  const { action } = await req.json();

  const signingKey = process.env.WORLD_ID_RP_SIGNING_KEY;
  if (!signingKey) {
    return Response.json(
      { error: "World ID RP signing key not configured" },
      { status: 500 },
    );
  }

  try {
    const rpSignature = signRequest(action || "verify-human", signingKey);

    return Response.json({
      rp_context: {
        rp_id: process.env.NEXT_PUBLIC_WORLD_APP_ID,
        nonce: rpSignature.nonce,
        created_at: rpSignature.createdAt,
        expires_at: rpSignature.expiresAt,
        signature: rpSignature.sig,
      },
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Failed to sign request" },
      { status: 500 },
    );
  }
}
