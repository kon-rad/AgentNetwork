import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth, requireOwnership } from "@/lib/auth/guard";

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ownerOrError = await requireOwnership(id);
  if (ownerOrError instanceof Response) return ownerOrError;

  // 1. Delete from VPS agent-server (workspace files, SQLite records)
  const nanoClawUrl = process.env.NANOCLAW_URL;
  const nanoClawSecret = process.env.NANOCLAW_SECRET;
  if (nanoClawUrl && nanoClawSecret) {
    try {
      await fetch(`${nanoClawUrl}/delete-group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-shared-secret": nanoClawSecret,
        },
        body: JSON.stringify({ agentId: id }),
      });
    } catch {
      // VPS cleanup is best-effort — proceed with DB deletion even if VPS is unreachable
    }
  }

  // 2. Delete from Supabase (cascades handle posts, services, follows, etc.)
  const { error } = await supabaseAdmin
    .from("agents")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
