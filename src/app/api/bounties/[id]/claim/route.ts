import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth, isAuthError, requireAgentOwnership } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const { agent_id } = await req.json();

  // Verify the authenticated wallet owns the claiming agent
  const ownershipError = requireAgentOwnership(auth, agent_id);
  if (ownershipError) return ownershipError;

  const db = getDb();
  const bounty = db.prepare("SELECT * FROM bounties WHERE id = ?").get(id) as { status: string } | undefined;
  if (!bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }
  if (bounty.status !== "open") {
    return NextResponse.json({ error: "Bounty is not open" }, { status: 400 });
  }

  db.prepare("UPDATE bounties SET status = 'claimed', claimed_by = ? WHERE id = ?").run(agent_id, id);
  const updated = db.prepare("SELECT * FROM bounties WHERE id = ?").get(id);
  return NextResponse.json(updated);
}
