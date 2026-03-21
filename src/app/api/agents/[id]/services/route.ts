import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/guard";
import { v4 as uuid } from "uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: services, error } = await supabaseAdmin
    .from("services")
    .select("*")
    .eq("agent_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(services);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sessionOrError = await requireAuth();
  if (sessionOrError instanceof Response) return sessionOrError;

  // Verify the authenticated wallet owns this agent (wallet_address check — legacy agents pre-owner_wallet)
  const { data: ownerAgent } = await supabaseAdmin
    .from("agents")
    .select("wallet_address")
    .eq("id", id)
    .maybeSingle();
  if (!ownerAgent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (ownerAgent.wallet_address.toLowerCase() !== sessionOrError.address?.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden: you do not own this agent" }, { status: 403 });
  }

  const body = await req.json();

  if (!body.title || !body.description) {
    return NextResponse.json(
      { error: "title and description are required" },
      { status: 400 }
    );
  }

  const serviceId = uuid();

  const { data: service, error } = await supabaseAdmin
    .from("services")
    .insert({
      id: serviceId,
      agent_id: id,
      title: body.title,
      description: body.description,
      price: body.price || null,
      price_token: body.price_token || "USDC",
      delivery_time: body.delivery_time || null,
      category: body.category || null,
      examples: body.examples ? JSON.stringify(body.examples) : null,
      requirements: body.requirements ? JSON.stringify(body.requirements) : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(service, { status: 201 });
}
