import { getSession, IronSessionData } from "./session";

export async function requireAuth(): Promise<IronSessionData | Response> {
  const session = await getSession();
  if (!session.authenticated || !session.address) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

// requireOwnership — see Task 3
