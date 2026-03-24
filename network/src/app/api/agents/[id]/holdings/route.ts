import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get holdings
  const { data: holdings, error: holdingsError } = await supabaseAdmin
    .from("agent_token_holdings")
    .select("*")
    .eq("agent_id", id)
    .order("last_updated", { ascending: false });

  if (holdingsError) {
    return NextResponse.json({ error: holdingsError.message }, { status: 500 });
  }

  // Get trading wallet address
  const { data: wallet } = await supabaseAdmin
    .from("agent_wallet_keys")
    .select("wallet_address")
    .eq("agent_id", id)
    .single();

  return NextResponse.json({
    holdings: holdings || [],
    tradingWallet: wallet?.wallet_address || null,
  });
}
