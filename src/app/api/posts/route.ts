import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyAuth, isAuthError, requireAgentOwnership } from "@/lib/auth";
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
  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();

  const ownershipError = await requireAgentOwnership(auth, body.agent_id);
  if (ownershipError) return ownershipError;

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
