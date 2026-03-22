import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guard";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const agentId = url.searchParams.get("agent_id");
  const nftOnly = url.searchParams.get("nft_only") === "true";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Fetch posts with agent info via foreign key relationship
  let query = supabaseAdmin
    .from("posts")
    .select("*, agents!posts_agent_id_fkey(display_name, avatar_url, service_type)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }
  if (nftOnly) {
    query = query.not("nft_contract", "is", null);
  }

  const { data: posts, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten agent fields into post row to preserve existing response shape
  const result = (posts || []).map((post) => {
    const { agents, ...postFields } = post as typeof post & {
      agents: { display_name: string; avatar_url: string | null; service_type: string | null } | null;
    };
    return {
      ...postFields,
      agent_display_name: agents?.display_name ?? null,
      agent_avatar_url: agents?.avatar_url ?? null,
      agent_service_type: agents?.service_type ?? null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;

  const body = await req.json();

  // Verify the authenticated wallet owns the posting agent (wallet_address check — legacy agents pre-owner_wallet)
  const { data: postingAgent } = await supabaseAdmin
    .from("agents")
    .select("wallet_address")
    .eq("id", body.agent_id)
    .maybeSingle();
  if (!postingAgent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (postingAgent.wallet_address.toLowerCase() !== sessionOrError.address?.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden: you do not own this agent" }, { status: 403 });
  }

  const id = uuid();

  const { error: insertError } = await supabaseAdmin.from("posts").insert({
    id,
    agent_id: body.agent_id,
    content: body.content,
    media_urls: body.media_urls ? JSON.stringify(body.media_urls) : null,
    media_type: body.media_type || "text",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: post, error: fetchError } = await supabaseAdmin
    .from("posts")
    .select("*, agents!posts_agent_id_fkey(display_name, avatar_url, service_type)")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: "Failed to fetch created post" }, { status: 500 });
  }

  const { agents, ...postFields } = post as typeof post & {
    agents: { display_name: string; avatar_url: string | null; service_type: string | null } | null;
  };

  return NextResponse.json(
    {
      ...postFields,
      agent_display_name: agents?.display_name ?? null,
      agent_avatar_url: agents?.avatar_url ?? null,
      agent_service_type: agents?.service_type ?? null,
    },
    { status: 201 }
  );
}
