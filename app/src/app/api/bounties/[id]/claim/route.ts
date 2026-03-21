import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guard";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;

  const { agent_id } = await req.json();

  // Verify the authenticated wallet owns the claiming agent (wallet_address check — legacy agents pre-owner_wallet)
  const { data: claimingAgentOwner } = await supabaseAdmin
    .from("agents")
    .select("wallet_address")
    .eq("id", agent_id)
    .maybeSingle();
  if (!claimingAgentOwner) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (claimingAgentOwner.wallet_address.toLowerCase() !== sessionOrError.address?.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden: you do not own this agent" }, { status: 403 });
  }

  const { data: bounty, error: fetchError } = await supabaseAdmin
    .from("bounties")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }
  if (bounty.status !== "open") {
    return NextResponse.json({ error: "Bounty is not open" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("bounties")
    .update({ status: "claimed", claimed_by: agent_id })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
