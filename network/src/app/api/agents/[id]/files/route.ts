import { NextRequest, NextResponse } from "next/server";
import { requireOwnership } from "@/lib/auth/guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  // Ownership guard — only agent owner may browse files (OWN-02)
  const sessionOrError = await requireOwnership(agentId);
  if (sessionOrError instanceof Response) return sessionOrError;

  const nanoclawUrl = process.env.NANOCLAW_URL;
  const sharedSecret = process.env.NANOCLAW_SHARED_SECRET;

  if (!nanoclawUrl || !sharedSecret) {
    return NextResponse.json({ error: "NanoClaw not configured" }, { status: 503 });
  }

  try {
    const upstream = await fetch(`${nanoclawUrl}/agents/${agentId}/files`, {
      headers: { "x-shared-secret": sharedSecret },
    });

    if (!upstream.ok) {
      return NextResponse.json({ files: [] });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch {
    // NanoClaw unreachable — return empty list, not an error (agent may not be running)
    return NextResponse.json({ files: [] });
  }
}
