import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guard";
import { transferUsdc } from "@/lib/chain/usdc";

interface BountyRow {
  id: string;
  status: string;
  claimed_by: string | null;
  reward_amount: string | null;
}

interface AgentRow {
  id: string;
  wallet_address: string;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;

  const { deliverable_url } = await req.json();

  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }

  const typedBounty = bounty as BountyRow;

  if (typedBounty.status !== "claimed") {
    return NextResponse.json({ error: "Bounty must be claimed first" }, { status: 400 });
  }

  // Only the agent who claimed this bounty can complete it
  const { data: claimingAgent } = await supabaseAdmin
    .from("agents")
    .select("id, wallet_address")
    .eq("id", typedBounty.claimed_by!)
    .maybeSingle();

  if (!claimingAgent) {
    return NextResponse.json({ error: "Claiming agent not found" }, { status: 404 });
  }

  const typedAgent = claimingAgent as AgentRow;

  if (typedAgent.wallet_address.toLowerCase() !== sessionOrError.address?.toLowerCase()) {
    return NextResponse.json(
      { error: "Forbidden: only the claiming agent can complete this bounty" },
      { status: 403 },
    );
  }

  // If reward is zero or null, complete without payment
  const hasReward = typedBounty.reward_amount && typedBounty.reward_amount !== "0";

  if (!hasReward) {
    const { data: updated } = await supabaseAdmin
      .from("bounties")
      .update({
        status: "completed",
        deliverable_url: deliverable_url || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json(updated);
  }

  // Set pending_payment before attempting transfer
  await supabaseAdmin
    .from("bounties")
    .update({ status: "pending_payment" })
    .eq("id", id);

  try {
    const txHash = await transferUsdc(
      typedAgent.wallet_address as `0x${string}`,
      typedBounty.reward_amount!,
    );

    const { data: updated } = await supabaseAdmin
      .from("bounties")
      .update({
        status: "completed",
        tx_hash: txHash,
        deliverable_url: deliverable_url || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json(updated);
  } catch (err) {
    await supabaseAdmin
      .from("bounties")
      .update({ status: "payment_failed" })
      .eq("id", id);

    const message = err instanceof Error ? err.message : "USDC transfer failed";
    return NextResponse.json(
      { error: message, status: "payment_failed" },
      { status: 502 },
    );
  }
}
