import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session.authenticated || !session.address) {
    return Response.json({ address: null, authenticated: false });
  }
  return Response.json({ address: session.address, chainId: session.chainId, authenticated: true });
}
