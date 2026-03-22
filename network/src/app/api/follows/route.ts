import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;

  const { follower_id, follower_type, following_id } = await req.json();

  if (!follower_id || !following_id) {
    return NextResponse.json({ error: "follower_id and following_id required" }, { status: 400 });
  }

  // If following as an agent, verify ownership (wallet_address check — legacy agents pre-owner_wallet)
  if (follower_type === "agent") {
    const { data: followerAgent } = await supabaseAdmin
      .from("agents")
      .select("wallet_address")
      .eq("id", follower_id)
      .maybeSingle();
    if (!followerAgent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (followerAgent.wallet_address.toLowerCase() !== sessionOrError.address?.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden: you do not own this agent" }, { status: 403 });
    }
  }

  // Check if already following (composite PK)
  const { data: existing } = await supabaseAdmin
    .from("follows")
    .select("follower_id")
    .eq("follower_id", follower_id)
    .eq("following_id", following_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Already following" }, { status: 409 });
  }

  const { error: insertError } = await supabaseAdmin.from("follows").insert({
    follower_id,
    follower_type: follower_type || "user",
    following_id,
  });

  if (insertError) {
    return NextResponse.json({ error: "Already following" }, { status: 409 });
  }

  // Increment follower_count on the followed agent
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("follower_count")
    .eq("id", following_id)
    .single();

  await supabaseAdmin
    .from("agents")
    .update({ follower_count: (agent?.follower_count ?? 0) + 1 })
    .eq("id", following_id);

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;

  const { follower_id, following_id } = await req.json();

  // Verify the follower belongs to the authenticated wallet
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("wallet_address")
    .eq("id", follower_id)
    .maybeSingle();

  if (agent && agent.wallet_address.toLowerCase() !== sessionOrError.address?.toLowerCase()) {
    return NextResponse.json(
      { error: "Forbidden: wallet does not own this agent" },
      { status: 403 },
    );
  }

  const { data: deleted } = await supabaseAdmin
    .from("follows")
    .delete()
    .eq("follower_id", follower_id)
    .eq("following_id", following_id)
    .select();

  if (deleted && deleted.length > 0) {
    // Decrement follower_count, floor at 0
    const { data: followedAgent } = await supabaseAdmin
      .from("agents")
      .select("follower_count")
      .eq("id", following_id)
      .single();

    const newCount = Math.max(0, (followedAgent?.follower_count ?? 1) - 1);
    await supabaseAdmin
      .from("agents")
      .update({ follower_count: newCount })
      .eq("id", following_id);
  }

  return NextResponse.json({ ok: true });
}
