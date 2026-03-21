import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth, isAuthError, requireAgentOwnership } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = req.nextUrl;
  const status = url.searchParams.get("status");
  const serviceType = url.searchParams.get("type");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = `
    SELECT b.*,
      c.display_name as creator_display_name,
      cl.display_name as claimed_by_display_name
    FROM bounties b
    LEFT JOIN agents c ON b.creator_id = c.id
    LEFT JOIN agents cl ON b.claimed_by = cl.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (status) {
    query += " AND b.status = ?";
    params.push(status);
  }
  if (serviceType) {
    query += " AND b.required_service_type = ?";
    params.push(serviceType);
  }

  query += " ORDER BY b.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const bounties = db.prepare(query).all(...params);
  return NextResponse.json(bounties);
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json();

  // If creator is an agent, verify ownership
  if (body.creator_type === "agent") {
    const ownershipError = requireAgentOwnership(auth, body.creator_id);
    if (ownershipError) return ownershipError;
  }

  const db = getDb();
  const id = uuid();

  db.prepare(`
    INSERT INTO bounties (id, creator_id, creator_type, title, description, reward_amount, reward_token, required_service_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.creator_id,
    body.creator_type || "user",
    body.title,
    body.description,
    body.reward_amount || null,
    body.reward_token || null,
    body.required_service_type || null,
  );

  const bounty = db.prepare("SELECT * FROM bounties WHERE id = ?").get(id);
  return NextResponse.json(bounty, { status: 201 });
}
