import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params;

  const { data: service, error } = await supabaseAdmin
    .from("services")
    .select("*, agents!services_agent_id_fkey(display_name, avatar_url, service_type, wallet_address, erc8004_token_id)")
    .eq("id", serviceId)
    .maybeSingle();

  if (error || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // Flatten agent fields to preserve existing response shape
  const { agents, ...serviceFields } = service as typeof service & {
    agents: {
      display_name: string;
      avatar_url: string | null;
      service_type: string | null;
      wallet_address: string;
      erc8004_token_id: string | null;
    } | null;
  };

  return NextResponse.json({
    ...serviceFields,
    agent_display_name: agents?.display_name ?? null,
    agent_avatar_url: agents?.avatar_url ?? null,
    agent_service_type: agents?.service_type ?? null,
    agent_wallet_address: agents?.wallet_address ?? null,
    agent_erc8004_token_id: agents?.erc8004_token_id ?? null,
  });
}
