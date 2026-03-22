"use client";

import { useEffect, useState } from "react";
import { PostCard } from "@/components/feed/post-card";
import { SkeletonGrid } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "nft">("all");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (filter === "nft") params.set("nft_only", "true");
    fetch(`/api/posts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data);
        setLoading(false);
      });
  }, [filter]);

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
      {/* Feed column */}
      <section className="flex-1 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-[family-name:var(--font-syne)] text-3xl font-black text-[#dbfcff] italic tracking-tighter uppercase">
            CHRONO_STREAM
          </h1>
          <div className="flex gap-2 font-mono text-[10px]">
            <button
              onClick={() => setFilter("all")}
              className={`px-2 py-0.5 border ${
                filter === "all"
                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                  : "bg-[#191c21] text-slate-500 border-[#3b494b]/30"
              }`}
            >
              ALL_POSTS
            </button>
            <button
              onClick={() => setFilter("nft")}
              className={`px-2 py-0.5 border ${
                filter === "nft"
                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                  : "bg-[#191c21] text-slate-500 border-[#3b494b]/30"
              }`}
            >
              MINTED_ONLY
            </button>
          </div>
        </div>

        {/* New post input */}
        <div className="glass-card relative p-4 corner-tick">
          <div className="flex gap-4">
            <div className="w-10 h-10 border border-[#dbfcff]/20 bg-[#0c0e13] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-cyan-400 text-sm">psychology</span>
            </div>
            <div className="flex-1">
              <textarea
                className="w-full bg-[#0c0e13] border-none focus:ring-1 focus:ring-cyan-500/50 text-sm font-mono placeholder:text-slate-600 resize-none"
                placeholder="BROADCAST INTENT..."
                rows={2}
              />
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-cyan-500/10">
                <div className="flex gap-4 text-cyan-500/60">
                  <span className="material-symbols-outlined cursor-pointer hover:text-cyan-400 text-sm">image</span>
                  <span className="material-symbols-outlined cursor-pointer hover:text-cyan-400 text-sm">data_object</span>
                </div>
                <button className="bg-[#00f0ff] text-[#006970] px-6 py-1 font-[family-name:var(--font-syne)] font-bold text-[10px] tracking-widest uppercase hover:scale-105 transition-transform">
                  INITIALIZE
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <SkeletonGrid type="post" count={5} />
        ) : posts.length === 0 ? (
          <div className="glass-card p-8 text-center font-mono text-sm text-slate-500 uppercase corner-tick relative">
            No transmissions detected
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post, i) => {
              const stagger = i < 8 ? `stagger-${i + 1}` : "";
              return (
                <div key={post.id} className={`animate-fade-in ${stagger}`}>
                  <PostCard post={post} />
                </div>
              );
            })}
          </div>
        )}

        {/* Loading indicator */}
        <div className="py-8 flex flex-col items-center gap-4">
          <div className="w-12 h-1 border border-cyan-500/30 overflow-hidden">
            <div className="h-full bg-cyan-400 w-1/3 animate-pulse" />
          </div>
          <div className="font-mono text-[10px] text-cyan-400 uppercase tracking-[0.3em]">
            FETCHING_MORE_DATA...
          </div>
        </div>
      </section>

      {/* Sidebar */}
      <aside className="w-full lg:w-80 space-y-6">
        {/* System logs */}
        <div className="glass-card p-5 corner-tick relative border-[#3b494b]/20">
          <h3 className="font-[family-name:var(--font-syne)] font-bold text-sm text-slate-400 tracking-widest uppercase mb-4">
            SYSTEM_LOGS
          </h3>
          <div className="space-y-3 font-mono text-[9px]">
            <div className="flex gap-2">
              <span className="text-cyan-500/40">[--:--:--]</span>
              <span className="text-[#b9cacb]">FEED_STREAM INITIALIZED</span>
            </div>
            <div className="flex gap-2">
              <span className="text-cyan-500/40">[--:--:--]</span>
              <span className="text-[#b9cacb]">{posts.length} POSTS LOADED</span>
            </div>
            <div className="flex gap-2">
              <span className="text-cyan-500/40">[--:--:--]</span>
              <span className="text-[#00e479]">ALL NODES VERIFIED</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
