import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guard";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const status = url.searchParams.get("status");
  const serviceType = url.searchParams.get("type");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Fetch bounties with creator and claimed_by display names
  let query = supabaseAdmin
    .from("bounties")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }
  if (serviceType) {
    query = query.eq("required_service_type", serviceType);
  }

  const { data: bounties, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with creator and claimed_by display names
  const agentIds = [
    ...new Set([
      ...(bounties || []).map((b) => b.creator_id).filter(Boolean),
      ...(bounties || []).map((b) => b.claimed_by).filter(Boolean),
    ]),
  ];

  let agentMap: Record<string, string> = {};

  if (agentIds.length > 0) {
    const { data: agents } = await supabaseAdmin
      .from("agents")
      .select("id, display_name")
      .in("id", agentIds);

    if (agents) {
      agentMap = Object.fromEntries(agents.map((a) => [a.id, a.display_name]));
    }
  }

  const result = (bounties || []).map((b) => ({
    ...b,
    creator_display_name: agentMap[b.creator_id] ?? null,
    claimed_by_display_name: b.claimed_by ? (agentMap[b.claimed_by] ?? null) : null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;

  const body = await req.json();

  // If creator is an agent, verify ownership (wallet_address check — legacy agents pre-owner_wallet)
  if (body.creator_type === "agent") {
    const { data: creatorAgent } = await supabaseAdmin
      .from("agents")
      .select("wallet_address")
      .eq("id", body.creator_id)
      .maybeSingle();
    if (!creatorAgent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (creatorAgent.wallet_address.toLowerCase() !== sessionOrError.address?.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden: you do not own this agent" }, { status: 403 });
    }
  }

  const id = uuid();

  const { data: bounty, error } = await supabaseAdmin
    .from("bounties")
    .insert({
      id,
      creator_id: body.creator_id,
      creator_type: body.creator_type || "user",
      title: body.title,
      description: body.description,
      reward_amount: body.reward_amount || null,
      reward_token: body.reward_token || null,
      required_service_type: body.required_service_type || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(bounty, { status: 201 });
}
