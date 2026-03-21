import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth, isAuthError, requireAgentOwnership } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
  if (!agent) {
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

  const ownershipError = requireAgentOwnership(auth, id);
  if (ownershipError) return ownershipError;

  const db = getDb();
  const body = await req.json();

  const allowedFields = [
    "display_name", "avatar_url", "bio", "service_type",
    "services_offered", "token_symbol", "ens_name",
  ];

  const sets: string[] = [];
  const values: (string | null)[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      sets.push(`${field} = ?`);
      const val = body[field];
      values.push(
        field === "services_offered" && val ? JSON.stringify(val) : (val ?? null)
      );
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE agents SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
  return NextResponse.json(agent);
}
