import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyAuth, isAuthError, requireAgentOwnership } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const { agent_id } = await req.json();

  // Verify the authenticated wallet owns the claiming agent
  const ownershipError = await requireAgentOwnership(auth, agent_id);
  if (ownershipError) return ownershipError;

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
