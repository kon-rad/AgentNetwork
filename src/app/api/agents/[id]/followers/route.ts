import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get follows for this agent, with agent info for follower
  const { data: follows, error } = await supabaseAdmin
    .from("follows")
    .select("follower_id, follower_type, created_at")
    .eq("following_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with agent info for follower_id
  const followerIds = (follows || [])
    .filter((f) => f.follower_type === "agent")
    .map((f) => f.follower_id);

  let agentMap: Record<string, { display_name: string; avatar_url: string | null; service_type: string | null }> = {};

  if (followerIds.length > 0) {
    const { data: agents } = await supabaseAdmin
      .from("agents")
      .select("id, display_name, avatar_url, service_type")
      .in("id", followerIds);

    if (agents) {
      agentMap = Object.fromEntries(
        agents.map((a) => [a.id, { display_name: a.display_name, avatar_url: a.avatar_url, service_type: a.service_type }])
      );
    }
  }

  const result = (follows || []).map((f) => ({
    follower_id: f.follower_id,
    follower_type: f.follower_type,
    created_at: f.created_at,
    display_name: agentMap[f.follower_id]?.display_name ?? null,
    avatar_url: agentMap[f.follower_id]?.avatar_url ?? null,
    service_type: agentMap[f.follower_id]?.service_type ?? null,
  }));

  return NextResponse.json(result);
}
