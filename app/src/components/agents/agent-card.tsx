"use client";

import Link from "next/link";
import type { Agent } from "@/lib/types";
import { useDisplayName } from "@/lib/hooks/use-display-name";

export function AgentCard({ agent }: { agent: Agent }) {
  const badgeClass = `badge-${agent.service_type}`;
  const ledClass = `badge-led-${agent.service_type}`;
  const { displayName: resolvedAddress } = useDisplayName(agent.wallet_address || undefined);
  const addressDisplay = agent.wallet_address ? resolvedAddress : agent.ens_name;

  return (
    <Link
      href={`/agent/${agent.id}`}
      className="group relative bg-slate-900/40 backdrop-blur-md border border-white/10 p-5 block hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(0,240,255,0.1)] transition-all animate-fade-in-up"
    >
      <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
        <span className="material-symbols-outlined text-cyan-400">qr_code_2</span>
      </div>

      <div className="flex items-start gap-4 mb-6">
        {/* Hexagonal avatar */}
        <div className="relative">
          <div className="w-16 h-16 hexagon-clip bg-cyan-950 border border-cyan-400/50 flex items-center justify-center text-xl font-bold text-cyan-400 group-hover:scale-105 transition-transform">
            {agent.avatar_url ? (
              <img src={agent.avatar_url} alt={agent.display_name} className="w-full h-full hexagon-clip object-cover" />
            ) : (
              agent.display_name.charAt(0)
            )}
          </div>
          {agent.self_verified && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-fuchsia-500 via-cyan-400 to-yellow-400 rounded-full border border-white/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[10px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-cyan-500 mb-1 uppercase">
            ID: {agent.id.slice(0, 6)}
          </div>
          <h3 className="font-[family-name:var(--font-syne)] font-bold text-xl leading-none text-white group-hover:text-cyan-400 transition-colors uppercase truncate">
            {agent.display_name}
          </h3>
          {agent.service_type && (
            <div className={`inline-block mt-2 px-2 py-0.5 text-[9px] font-mono uppercase ${badgeClass}`}>
              {agent.service_type}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-cyan-900/30 pt-4 mb-6">
        <div>
          <div className="font-mono text-[9px] text-slate-500 uppercase">Followers</div>
          <div className="font-mono text-sm text-[#e1e2ea]">
            {agent.follower_count >= 1000 ? `${(agent.follower_count / 1000).toFixed(1)}K` : agent.follower_count}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] text-slate-500 uppercase">Token</div>
          <div className="font-mono text-sm text-[#f6be37]">
            {agent.token_symbol ? `$${agent.token_symbol}` : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex-1 bg-white/5 border border-white/10 py-2 font-mono text-[10px] text-slate-300 text-center uppercase hover:bg-cyan-500 hover:text-slate-950 hover:border-cyan-500 transition-all">
          View Intel
        </span>
        <span className="w-10 h-10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/10 transition-all">
          <span className="material-symbols-outlined text-sm">favorite</span>
        </span>
      </div>
    </Link>
  );
}
