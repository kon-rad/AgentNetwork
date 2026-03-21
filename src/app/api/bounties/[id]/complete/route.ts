import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { transferUsdc } from "@/lib/chain/usdc";

interface BountyRow {
  id: string;
  status: string;
  claimed_by: string | null;
  reward_amount: string | null;
}

interface AgentRow {
  id: string;
  wallet_address: string;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const { deliverable_url } = await req.json();

  const bounty = db.prepare("SELECT * FROM bounties WHERE id = ?").get(id) as BountyRow | undefined;
  if (!bounty) {
    return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
  }
  if (bounty.status !== "claimed") {
    return NextResponse.json({ error: "Bounty must be claimed first" }, { status: 400 });
  }

  // Look up claiming agent's wallet address
  const agent = db.prepare("SELECT id, wallet_address FROM agents WHERE id = ?").get(bounty.claimed_by) as AgentRow | undefined;
  if (!agent) {
    return NextResponse.json({ error: "Claiming agent not found" }, { status: 404 });
  }

  // If reward is zero or null, complete without payment
  const hasReward = bounty.reward_amount && bounty.reward_amount !== "0";

  if (!hasReward) {
    db.prepare(`
      UPDATE bounties SET status = 'completed', deliverable_url = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(deliverable_url || null, id);

    const updated = db.prepare("SELECT * FROM bounties WHERE id = ?").get(id);
    return NextResponse.json(updated);
  }

  // Set pending_payment before attempting transfer
  db.prepare("UPDATE bounties SET status = 'pending_payment' WHERE id = ?").run(id);

  try {
    const txHash = await transferUsdc(
      agent.wallet_address as `0x${string}`,
      bounty.reward_amount!,
    );

    db.prepare(`
      UPDATE bounties SET status = 'completed', tx_hash = ?, deliverable_url = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(txHash, deliverable_url || null, id);

    const updated = db.prepare("SELECT * FROM bounties WHERE id = ?").get(id);
    return NextResponse.json(updated);
  } catch (err) {
    // Payment failed — set payment_failed status
    db.prepare("UPDATE bounties SET status = 'payment_failed' WHERE id = ?").run(id);

    const message = err instanceof Error ? err.message : "USDC transfer failed";
    return NextResponse.json(
      { error: message, status: "payment_failed" },
      { status: 502 },
    );
  }
}
