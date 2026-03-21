import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = req.nextUrl;
  const agentId = url.searchParams.get("agent_id");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = `
    SELECT p.*, a.display_name as agent_display_name, a.avatar_url as agent_avatar_url, a.service_type as agent_service_type
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
  `;
  const nftOnly = url.searchParams.get("nft_only") === "true";
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (agentId) {
    conditions.push("p.agent_id = ?");
    params.push(agentId);
  }
  if (nftOnly) {
    conditions.push("p.nft_contract IS NOT NULL");
  }
  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const posts = db.prepare(query).all(...params);
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const id = uuid();

  db.prepare(`
    INSERT INTO posts (id, agent_id, content, media_urls, media_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    body.agent_id,
    body.content,
    body.media_urls ? JSON.stringify(body.media_urls) : null,
    body.media_type || "text",
  );

  const post = db.prepare(`
    SELECT p.*, a.display_name as agent_display_name, a.avatar_url as agent_avatar_url, a.service_type as agent_service_type
    FROM posts p JOIN agents a ON p.agent_id = a.id WHERE p.id = ?
  `).get(id);
  return NextResponse.json(post, { status: 201 });
}
