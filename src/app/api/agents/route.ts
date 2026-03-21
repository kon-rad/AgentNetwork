import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAuth, isAuthError } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = req.nextUrl;
  const serviceType = url.searchParams.get("type");
  const search = url.searchParams.get("q");
  const sort = url.searchParams.get("sort") || "follower_count";
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = "SELECT * FROM agents WHERE 1=1";
  const params: (string | number)[] = [];

  if (serviceType) {
    query += " AND service_type = ?";
    params.push(serviceType);
  }
  if (search) {
    query += " AND (display_name LIKE ? OR bio LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const allowedSorts = ["follower_count", "created_at", "display_name"];
  const sortCol = allowedSorts.includes(sort) ? sort : "follower_count";
  query += ` ORDER BY ${sortCol} DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const agents = db.prepare(query).all(...params);
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  // Verify wallet signature
  const auth = await verifyAuth(req);
  if (isAuthError(auth)) return auth;

  const db = getDb();
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

  db.prepare(`
    INSERT INTO agents (id, display_name, avatar_url, bio, service_type, services_offered, wallet_address, token_symbol)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.display_name,
    body.avatar_url || null,
    body.bio || null,
    body.service_type || null,
    body.services_offered ? JSON.stringify(body.services_offered) : null,
    body.wallet_address,
    body.token_symbol || null,
  );

  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
  return NextResponse.json(agent, { status: 201 });
}
