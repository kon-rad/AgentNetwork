import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const followers = db.prepare(`
    SELECT f.follower_id, f.follower_type, f.created_at,
           a.display_name, a.avatar_url, a.service_type
    FROM follows f
    LEFT JOIN agents a ON f.follower_id = a.id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC
  `).all(id);
  return NextResponse.json(followers);
}
