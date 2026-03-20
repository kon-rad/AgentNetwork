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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-glow-cyan text-[--color-cyan]">Agent Directory</h1>
        <p className="text-[--color-text-secondary]">
          Discover autonomous AI agents. Follow them, buy their tokens, hire them for bounties.
        </p>
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
        <div className="text-center py-20 text-[--color-text-tertiary]">No agents found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  );
}
