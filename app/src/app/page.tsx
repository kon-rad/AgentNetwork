"use client";

import { useEffect, useState } from "react";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentFilter } from "@/components/agents/agent-filter";
import { SkeletonGrid } from "@/components/ui/skeleton";
import type { Agent } from "@/lib/types";

export default function DirectoryPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    fetchAgents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, search]);

  async function fetchAgents() {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeType) params.set("type", activeType);
    if (search) params.set("q", search);
    const res = await fetch(`/api/agents?${params}`);
    const data = await res.json();

    if (data.length === 0 && !seeded) {
      await fetch("/api/seed", { method: "POST" });
      setSeeded(true);
      const res2 = await fetch(`/api/agents?${params}`);
      const data2 = await res2.json();
      setAgents(data2);
    } else {
      setAgents(data);
    }
    setLoading(false);
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header with HUD stats */}
      <div className="flex justify-between items-end mb-8 border-b border-cyan-900/30 pb-4">
        <div>
          <div className="font-mono text-[10px] text-cyan-500/60 uppercase tracking-widest mb-1">
            Root / Directory / Verified_Agents
          </div>
          <h1 className="font-[family-name:var(--font-syne)] text-4xl font-extrabold tracking-tighter uppercase text-white">
            Agent Directory
          </h1>
        </div>
        <div className="hidden lg:flex items-center gap-8 font-mono text-[10px]">
          <div className="text-right">
            <div className="text-slate-500">ACTIVE_NODES</div>
            <div className="text-cyan-400">{agents.length}</div>
          </div>
          <div className="text-right">
            <div className="text-slate-500">GAS_INDEX</div>
            <div className="text-[#f6be37]">42.1 GWEI</div>
          </div>
        </div>
      </div>

      <AgentFilter
        activeType={activeType}
        onTypeChange={setActiveType}
        searchQuery={search}
        onSearchChange={setSearch}
      />

      {loading ? (
        <SkeletonGrid type="agent" count={6} />
      ) : agents.length === 0 ? (
        <div className="text-center py-20 font-mono text-sm text-slate-500 uppercase">
          No agents found
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent, i) => {
            const stagger = i < 8 ? `stagger-${i + 1}` : "";
            return (
              <div key={agent.id} className={`animate-fade-in-up ${stagger}`}>
                <AgentCard agent={agent} />
              </div>
            );
          })}
        </div>
      )}

      {/* System log footer */}
      <div className="mt-12 font-mono text-[10px] text-slate-600 flex justify-between items-center border-t border-cyan-900/20 pt-4">
        <span>DISPLAYING {agents.length} ACTIVE AGENTS</span>
        <span>AGENT NETWORK v4.2.0</span>
      </div>
    </div>
  );
}
