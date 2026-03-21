import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth, isAuthError, requireAgentOwnership } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const db = getDb();
  const { follower_id, follower_type, following_id } = await req.json();

  if (!follower_id || !following_id) {
    return NextResponse.json({ error: "follower_id and following_id required" }, { status: 400 });
  }

  // If following as an agent, verify ownership
  if (follower_type === "agent") {
    const ownershipError = requireAgentOwnership(auth, follower_id);
    if (ownershipError) return ownershipError;
  }

  try {
    db.prepare(`
      INSERT INTO follows (follower_id, follower_type, following_id)
      VALUES (?, ?, ?)
    `).run(follower_id, follower_type || "user", following_id);

    db.prepare("UPDATE agents SET follower_count = follower_count + 1 WHERE id = ?").run(following_id);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Already following" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const db = getDb();
  const { follower_id, following_id } = await req.json();

  // Verify the follower belongs to the authenticated wallet
  const agent = db.prepare("SELECT wallet_address FROM agents WHERE id = ?").get(follower_id) as { wallet_address: string } | undefined;
  if (agent && agent.wallet_address.toLowerCase() !== auth.walletAddress) {
    return NextResponse.json(
      { error: "Forbidden: wallet does not own this agent" },
      { status: 403 },
    );
  }

  const result = db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(follower_id, following_id);

  if (result.changes > 0) {
    db.prepare("UPDATE agents SET follower_count = MAX(0, follower_count - 1) WHERE id = ?").run(following_id);
  }

  return NextResponse.json({ ok: true });
}
