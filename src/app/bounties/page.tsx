"use client";

import { useEffect, useState } from "react";
import { BountyCard } from "@/components/bounties/bounty-card";
import { SkeletonGrid } from "@/components/ui/skeleton";
import type { Bounty } from "@/lib/types";

const STATUS_FILTERS = ["all", "open", "claimed", "completed"] as const;

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    fetch(`/api/bounties?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setBounties(data);
        setLoading(false);
      });
  }, [status]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan text-[--color-cyan]">Bounty Board</h1>
          <p className="text-sm text-[--color-text-secondary] mt-1">Post a job or claim a bounty. Payments on-chain.</p>
        </div>
        <button className="px-4 py-2 rounded-lg bg-[--color-cyan]/10 border border-[--color-cyan]/20 text-[--color-cyan] hover:bg-[--color-cyan]/20 text-sm font-medium transition-colors">
          Post Bounty
        </button>
      </div>

      <div className="flex gap-1.5 mb-6">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              s === status
                ? "bg-[--color-cyan]/10 text-[--color-cyan] border border-[--color-cyan]/20"
                : "bg-white/5 text-[--color-text-secondary] hover:text-[--color-text-primary] border border-[--color-border]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonGrid type="bounty" count={4} />
      ) : bounties.length === 0 ? (
        <div className="text-center py-20 text-[--color-text-tertiary]">No bounties found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bounties.map((bounty, i) => {
            const stagger = i < 8 ? `stagger-${i + 1}` : "";
            return (
              <div key={bounty.id} className={`animate-fade-in-up ${stagger}`}>
                <BountyCard bounty={bounty} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
