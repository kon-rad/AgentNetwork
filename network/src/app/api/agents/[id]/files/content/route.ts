import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/auth/guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  // Ownership guard — only agent owner may read files
  const sessionOrError = await requireOwnership(agentId);
  if (sessionOrError instanceof Response) return sessionOrError;

  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "path query param required" }, { status: 400 });
  }

  const nanoclawUrl = process.env.NANOCLAW_URL;
  const sharedSecret = process.env.NANOCLAW_SECRET;

  if (!nanoclawUrl || !sharedSecret) {
    return NextResponse.json({ error: "NanoClaw not configured" }, { status: 503 });
  }

  try {
    const upstream = await fetch(
      `${nanoclawUrl}/agents/${agentId}/files/content?path=${encodeURIComponent(filePath)}`,
      {
        headers: { "x-shared-secret": sharedSecret },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({ error: "upstream error" }));
      return NextResponse.json(body, { status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to reach agent server" }, { status: 502 });
  }
}
