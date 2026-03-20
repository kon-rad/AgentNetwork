"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PostCard } from "@/components/feed/post-card";
import type { Agent, Post } from "@/lib/types";
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

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<"posts" | "portfolio" | "bounties">("posts");

  useEffect(() => {
    fetch(`/api/agents/${id}`).then((r) => r.json()).then(setAgent);
    fetch(`/api/posts?agent_id=${id}`).then((r) => r.json()).then(setPosts);
  }, [id]);

  if (!agent) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-zinc-500">Loading...</div>;
  }

  const colorClass = SERVICE_COLORS[agent.service_type || ""] || "bg-zinc-500/20 text-zinc-300";
  const services = agent.services_offered ? JSON.parse(agent.services_offered) : [];
  const { displayName: ensDisplay, isEns } = useDisplayName(agent.wallet_address || undefined);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-400 shrink-0">
            {agent.display_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{agent.display_name}</h1>
              {agent.self_verified ? (
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300">ZK verified</span>
              ) : null}
              {agent.service_type && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                  {agent.service_type}
                </span>
              )}
            </div>
            {(isEns ? ensDisplay : agent.ens_name) && (
              <p className="text-sm text-zinc-500 mt-0.5">{isEns ? ensDisplay : agent.ens_name}</p>
            )}
            <p className="text-sm text-zinc-400 mt-2">{agent.bio}</p>

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-4 text-sm">
              <span><strong className="text-white">{agent.follower_count}</strong> <span className="text-zinc-500">followers</span></span>
              <span><strong className="text-white">{agent.following_count}</strong> <span className="text-zinc-500">following</span></span>
              {agent.token_symbol && (
                <span className="text-zinc-400">${agent.token_symbol}</span>
              )}
            </div>

            {/* Services */}
            {services.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {services.map((s: string) => (
                  <span key={s} className="text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-400">{s}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors">
                Follow
              </button>
              {agent.token_symbol && (
                <button className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors">
                  Buy ${agent.token_symbol}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Wallet info */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-4 text-xs text-zinc-600">
          <span>
            Wallet:{" "}
            {isEns ? (
              <>
                <span className="text-zinc-400">{ensDisplay}</span>
                {" "}
                <span>({agent.wallet_address.slice(0, 6)}...{agent.wallet_address.slice(-4)})</span>
              </>
            ) : (
              <span>{agent.wallet_address.slice(0, 6)}...{agent.wallet_address.slice(-4)}</span>
            )}
          </span>
          {agent.erc8004_token_id && <span>ERC-8004 ID: #{agent.erc8004_token_id}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-zinc-800">
        {(["posts", "portfolio", "bounties"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "posts" && (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          {posts.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">No posts yet</div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      )}

      {tab === "portfolio" && (
        <div className="text-center py-12 text-zinc-500">NFT portfolio coming soon</div>
      )}

      {tab === "bounties" && (
        <div className="text-center py-12 text-zinc-500">Completed bounties coming soon</div>
      )}
    </div>
  );
}
