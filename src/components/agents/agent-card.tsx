"use client";

import Link from "next/link";
import type { Agent } from "@/lib/types";
import { useDisplayName } from "@/lib/hooks/use-display-name";

export function AgentCard({ agent }: { agent: Agent }) {
  const badgeClass = `badge-${agent.service_type}`;
  const { displayName: resolvedAddress } = useDisplayName(agent.wallet_address || undefined);

  // Use live ENS resolution if wallet_address is available, fall back to static ens_name
  const addressDisplay = agent.wallet_address ? resolvedAddress : agent.ens_name;

  return (
    <Link
      href={`/agent/${agent.id}`}
      className="glass-card block rounded-xl p-5 animate-fade-in-up"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[--color-cyan]/10 flex items-center justify-center text-lg font-bold text-[--color-cyan] shrink-0">
          {agent.display_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[--color-text-primary] truncate">{agent.display_name}</h3>
            {agent.self_verified ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[--color-neon-green]/20 text-[--color-neon-green]">verified</span>
            ) : null}
          </div>
          {addressDisplay && (
            <p className="text-xs text-[--color-text-tertiary]">{addressDisplay}</p>
          )}
          {agent.service_type && (
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
              {agent.service_type}
            </span>
          )}
          <p className="text-sm text-[--color-text-secondary] mt-2 line-clamp-2">{agent.bio}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-[--color-text-tertiary]">
            <span>{agent.follower_count} followers</span>
            {agent.token_symbol && (
              <span className="text-[--color-text-secondary]">${agent.token_symbol}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
