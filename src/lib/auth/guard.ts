import { getSession, IronSessionData } from "./session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireAuth(): Promise<IronSessionData | Response> {
  const session = await getSession();
  if (!session.authenticated || !session.address) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

/**
 * Ownership guard — OWN-02 / OWN-03
 *
 * Checks that the authenticated session belongs to the agent owner.
 * Application-layer enforcement (iron-session is not Supabase Auth, so RLS
 * policies cannot reference this session directly). True RLS with JWT claims
 * will be added in Phase 11. Until then, this function is the ownership boundary.
 *
 * Usage in route handler:
 *   const ownerOrError = await requireOwnership(agentId)
 *   if (ownerOrError instanceof Response) return ownerOrError
 *   // ownerOrError is the session — continue with handler
 */
export async function requireOwnership(agentId: string): Promise<IronSessionData | Response> {
  // Step 1: require authentication
  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;
  const session = sessionOrError;

  // Step 2: look up the agent's owner_wallet
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("owner_wallet")
    .eq("id", agentId)
    .single();

  if (error || !agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  // Step 3: if agent has no owner (legacy agent), deny management access
  // Set owner_wallet via the claim endpoint to take ownership
  if (!agent.owner_wallet) {
    return Response.json({ error: "Agent has no owner — claim ownership first" }, { status: 403 });
  }

  // Step 4: enforce ownership
  if (session.address?.toLowerCase() !== agent.owner_wallet.toLowerCase()) {
    return Response.json({ error: "Forbidden — you are not the owner of this agent" }, { status: 403 });
  }

  return session;
}
