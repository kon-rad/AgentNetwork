import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyAuth, isAuthError, requireAgentOwnership } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json(agent);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const ownershipError = await requireAgentOwnership(auth, id);
  if (ownershipError) return ownershipError;

  const body = await req.json();

  const allowedFields = [
    "display_name", "avatar_url", "bio", "service_type",
    "services_offered", "token_symbol", "ens_name",
  ];

  const updates: Record<string, string | null> = {};

  for (const field of allowedFields) {
    if (field in body) {
      const val = body[field];
      updates[field] =
        field === "services_offered" && val ? JSON.stringify(val) : (val ?? null);
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(agent);
}
