import { getSession } from "@/lib/auth/session";
import { verifySiweMessage } from "@/lib/auth/siwe";

export async function POST(req: Request) {
  const { message, signature } = await req.json();
  const session = await getSession();

  if (!session.nonce) {
    return Response.json({ error: "No nonce in session — call /api/auth/siwe/nonce first" }, { status: 422 });
  }

  const result = await verifySiweMessage(message, signature, session.nonce);

  if (!result.success) {
    return Response.json({ error: result.error ?? "Invalid signature" }, { status: 422 });
  }

  session.address = result.address;
  session.chainId = result.chainId;
  session.authenticated = true;
  session.nonce = undefined; // consume nonce — prevent replay
  await session.save();

  return Response.json({ address: result.address });
}
