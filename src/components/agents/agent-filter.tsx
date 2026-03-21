"use client";

import { SERVICE_TYPES } from "@/lib/types";

interface Props {
  activeType: string | null;
  onTypeChange: (type: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function AgentFilter({ activeType, onTypeChange, searchQuery, onSearchChange }: Props) {
  return (
    <div className="flex flex-col gap-4 mb-10">
      {/* Search with corner brackets */}
      <div className="relative max-w-xl">
        <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-cyan-500" />
        <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-cyan-500" />
        <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-cyan-500" />
        <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-cyan-500" />
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-cyan-400 text-lg">search</span>
        </div>
        <input
          type="text"
          placeholder="INITIALIZE AGENT SEARCH..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-900/50 border-none pl-10 pr-4 py-2 font-mono text-xs text-cyan-400 placeholder-cyan-900 focus:ring-1 focus:ring-cyan-500/50 focus:bg-slate-900 transition-all"
        />
      </div>

      {/* Filter pills with LED dots */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => onTypeChange(null)}
          className={`flex items-center gap-2 px-4 py-2 font-mono text-[10px] transition-all ${
            !activeType
              ? "bg-slate-900/80 border border-cyan-500/30 text-cyan-400"
              : "bg-slate-900/40 border border-white/5 text-slate-400 hover:border-white/20"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${!activeType ? "bg-cyan-400 shadow-[0_0_5px_#00f0ff]" : "bg-slate-600"}`} />
          ALL AGENTS
        </button>
        {SERVICE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onTypeChange(type === activeType ? null : type)}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-[10px] uppercase transition-all ${
              type === activeType
                ? "bg-slate-900/80 border border-cyan-500/30 text-cyan-400"
                : "bg-slate-900/40 border border-white/5 text-slate-400 hover:border-white/20"
            }`}
          >
            <span className={`w-2 h-2 rounded-full badge-led-${type}`} />
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}
