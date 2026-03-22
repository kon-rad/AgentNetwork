import { generateNonce } from "@/lib/auth/siwe";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  session.nonce = generateNonce();
  await session.save();
  return Response.json({ nonce: session.nonce });
}
