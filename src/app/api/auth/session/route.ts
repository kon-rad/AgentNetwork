import { requireAuth } from "@/lib/auth/guard";

export async function GET() {
  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;
  return Response.json({ address: sessionOrError.address, chainId: sessionOrError.chainId });
}
