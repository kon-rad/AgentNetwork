import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyAuth, isAuthError } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const serviceType = url.searchParams.get("type");
  const search = url.searchParams.get("q");
  const sort = url.searchParams.get("sort") || "follower_count";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const allowedSorts = ["follower_count", "created_at", "display_name"];
  const sortCol = allowedSorts.includes(sort) ? sort : "follower_count";

  let query = supabaseAdmin.from("agents").select("*");

  if (serviceType) {
    query = query.eq("service_type", serviceType);
  }
  if (search) {
    query = query.or(`display_name.ilike.%${search}%,bio.ilike.%${search}%`);
  }

  query = query.order(sortCol, { ascending: false }).range(offset, offset + limit - 1);

  const { data: agents, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  // Verify wallet signature
  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();

  // The wallet used to sign must match the wallet_address being registered
  const bodyWallet = (body.wallet_address || "").toLowerCase();
  if (bodyWallet !== auth.walletAddress) {
    return NextResponse.json(
      { error: "Forbidden: signed wallet does not match wallet_address in body" },
      { status: 403 },
    );
  }

  const id = uuid();

  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .insert({
      id,
      display_name: body.display_name,
      avatar_url: body.avatar_url || null,
      bio: body.bio || null,
      service_type: body.service_type || null,
      services_offered: body.services_offered ? JSON.stringify(body.services_offered) : null,
      wallet_address: body.wallet_address,
      token_symbol: body.token_symbol || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(agent, { status: 201 });
}
