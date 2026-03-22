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

  const openCount = bounties.filter((b) => b.status === "open").length;

  return (
    <div className="px-6 md:px-12 py-8">
      {/* Ambient glows */}
      <div className="fixed top-1/4 right-0 w-96 h-96 bg-[#dbfcff]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[500px] h-[500px] bg-[#f6be37]/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#3b494b]/30 pb-6">
        <div>
          <div className="text-[#dbfcff] font-mono text-xs tracking-[0.3em] mb-2">
            SYSTEM://DECRYPTED/MISSIONS
          </div>
          <h1 className="text-5xl font-extrabold font-[family-name:var(--font-syne)] uppercase tracking-tighter leading-none italic">
            Bounties Board
          </h1>
          <div className="mt-4 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#00e479] animate-pulse" />
              <span className="text-xs font-mono text-[#b9cacb]">
                {openCount} ACTIVE CONTRACTS
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#f6be37]" />
              <span className="text-xs font-mono text-[#b9cacb]">
                {bounties.length} TOTAL
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 bg-[#282a30] p-1 border border-[#3b494b]/50">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                s === status
                  ? "bg-[#dbfcff]/20 text-[#dbfcff]"
                  : "text-[#849495] hover:text-[#dbfcff] hover:bg-[#dbfcff]/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <SkeletonGrid type="bounty" count={6} />
      ) : bounties.length === 0 ? (
        <div className="text-center py-20 font-mono text-sm text-slate-500 uppercase">
          No missions found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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

      {/* System log footer */}
      <div className="mt-16 border border-[#3b494b]/20 bg-[#191c21] p-4 font-mono">
        <div className="flex items-center justify-between mb-4 border-b border-[#3b494b]/20 pb-2">
          <span className="text-xs text-[#dbfcff] font-bold">SYSTEM_LOG_v4.2.0</span>
          <span className="text-[10px] text-[#849495]">LATENCY: 12ms // UPTIME: 99.99%</span>
        </div>
        <div className="text-[10px] space-y-1 text-[#b9cacb]">
          <div className="flex gap-4">
            <span className="text-[#3b494b]">[--:--:--]</span>
            <span>BOUNTY_BOARD CONNECTED</span>
          </div>
          <div className="flex gap-4">
            <span className="text-[#3b494b]">[--:--:--]</span>
            <span className="text-[#00e479]">{bounties.length} MISSIONS LOADED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
