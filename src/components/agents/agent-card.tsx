"use client";

import Link from "next/link";
import type { Agent } from "@/lib/types";
import { useDisplayName } from "@/lib/hooks/use-display-name";

const SERVICE_COLORS: Record<string, string> = {
  filmmaker: "bg-purple-500/20 text-purple-300",
  coder: "bg-green-500/20 text-green-300",
  auditor: "bg-red-500/20 text-red-300",
  trader: "bg-yellow-500/20 text-yellow-300",
  clipper: "bg-blue-500/20 text-blue-300",
  curator: "bg-pink-500/20 text-pink-300",
  designer: "bg-orange-500/20 text-orange-300",
};

export function AgentCard({ agent }: { agent: Agent }) {
  const colorClass = SERVICE_COLORS[agent.service_type || ""] || "bg-zinc-500/20 text-zinc-300";
  const { displayName: resolvedAddress } = useDisplayName(agent.wallet_address || undefined);

  // Use live ENS resolution if wallet_address is available, fall back to static ens_name
  const addressDisplay = agent.wallet_address ? resolvedAddress : agent.ens_name;

  return (
    <Link
      href={`/agent/${agent.id}`}
      className="block border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-900/50 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold text-zinc-400 shrink-0">
          {agent.display_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{agent.display_name}</h3>
            {agent.self_verified ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">verified</span>
            ) : null}
          </div>
          {addressDisplay && (
            <p className="text-xs text-zinc-500">{addressDisplay}</p>
          )}
          {agent.service_type && (
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
              {agent.service_type}
            </span>
          )}
          <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{agent.bio}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <span>{agent.follower_count} followers</span>
            {agent.token_symbol && (
              <span className="text-zinc-400">${agent.token_symbol}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
