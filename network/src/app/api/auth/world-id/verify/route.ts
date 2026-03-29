import { getSession } from "@/lib/auth/session";
import { createClient } from "@supabase/supabase-js";

/**
 * Verify a World ID proof and mark an agent as human-verified.
 *
 * Flow:
 * 1. Frontend collects proof via IDKitRequestWidget
 * 2. This endpoint verifies the proof via World ID API
 * 3. On success, stores nullifier_hash (anti-replay) and sets
 *    agentbook_registered = true on the agent's wallet
 *
 * Requires authenticated session (user must be signed in).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session.authenticated || !session.address) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { proof, agentId } = await req.json();

  if (!proof || !agentId) {
    return Response.json(
      { error: "proof and agentId required" },
      { status: 400 },
    );
  }

  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  if (!appId) {
    return Response.json(
      { error: "World App ID not configured" },
      { status: 500 },
    );
  }

  // Verify the agent is owned by the current user
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: agent } = await supabase
    .from("agents")
    .select("owner_wallet, wallet_address")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.owner_wallet?.toLowerCase() !== session.address.toLowerCase()) {
    return Response.json(
      { error: "You are not the owner of this agent" },
      { status: 403 },
    );
  }

  try {
    // Verify the proof with World ID API
    const verifyRes = await fetch(
      `https://developer.world.org/api/v4/verify/${appId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      },
    );

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      return Response.json(
        {
          error: "World ID verification failed",
          detail: verifyData.detail || verifyData.code,
        },
        { status: 422 },
      );
    }

    const nullifier = verifyData.nullifier;

    // Check for replay — same nullifier shouldn't verify twice
    const { data: existingNullifier } = await supabase
      .from("world_id_nullifiers")
      .select("nullifier_hash")
      .eq("nullifier_hash", nullifier)
      .single();

    if (existingNullifier) {
      return Response.json(
        { error: "This World ID has already been used to verify an agent" },
        { status: 409 },
      );
    }

    // Store the nullifier for anti-replay
    await supabase.from("world_id_nullifiers").insert({
      nullifier_hash: nullifier,
      agent_id: agentId,
      owner_wallet: session.address,
      verification_level: verifyData.results?.[0]?.credential_type || "unknown",
    });

    // Mark the agent's wallet as AgentBook registered
    if (agent.wallet_address) {
      await supabase
        .from("agent_wallet_keys")
        .update({ agentbook_registered: true })
        .eq("wallet_address", agent.wallet_address);
    }

    // Store verification status on the agent
    await supabase
      .from("agents")
      .update({
        world_id_verified: true,
        world_id_verification_level:
          verifyData.results?.[0]?.credential_type || "unknown",
      })
      .eq("id", agentId);

    return Response.json({
      success: true,
      verified: true,
      nullifier,
      verification_level:
        verifyData.results?.[0]?.credential_type || "unknown",
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Verification failed" },
      { status: 500 },
    );
  }
}
