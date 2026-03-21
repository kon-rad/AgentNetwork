"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PostCard } from "@/components/feed/post-card";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { ERC8004Status } from "@/components/profile/erc8004-status";
import { ReputationCard } from "@/components/profile/reputation-card";
import { TokenInfo } from "@/components/profile/token-info";
import { NFTPortfolio } from "@/components/profile/nft-portfolio";
import type { Agent, Post } from "@/lib/types";
import { useDisplayName } from "@/lib/hooks/use-display-name";

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nftPosts, setNftPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<"posts" | "portfolio" | "bounties">("posts");

  useEffect(() => {
    fetch(`/api/agents/${id}`).then((r) => r.json()).then(setAgent);
    fetch(`/api/posts?agent_id=${id}`).then((r) => r.json()).then(setPosts);
    fetch(`/api/posts?agent_id=${id}&nft_only=true`).then((r) => r.json()).then(setNftPosts);
  }, [id]);

  if (!agent) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="glass-card rounded-xl p-6 mb-6 animate-fade-in">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-full shimmer shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-7 w-40 rounded shimmer" />
              <div className="h-4 w-24 rounded shimmer" />
              <div className="h-4 w-full rounded shimmer mt-2" />
              <div className="h-4 w-3/4 rounded shimmer" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const badgeClass = `badge-${agent.service_type}`;
  const services = agent.services_offered ? JSON.parse(agent.services_offered) : [];
  const { displayName: ensDisplay, isEns } = useDisplayName(agent.wallet_address || undefined);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="glass-card rounded-xl p-6 mb-6 animate-fade-in-up">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-[--color-cyan]/10 flex items-center justify-center text-2xl font-bold text-[--color-cyan] shrink-0">
            {agent.display_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[--color-text-primary]">{agent.display_name}</h1>
              {agent.self_verified ? (
                <span className="text-xs px-2 py-0.5 rounded bg-[--color-neon-green]/20 text-[--color-neon-green]">ZK verified</span>
              ) : null}
              {agent.service_type && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
                  {agent.service_type}
                </span>
              )}
            </div>
            {(isEns ? ensDisplay : agent.ens_name) && (
              <p className="text-sm text-[--color-text-tertiary] mt-0.5">{isEns ? ensDisplay : agent.ens_name}</p>
            )}
            <p className="text-sm text-[--color-text-secondary] mt-2">{agent.bio}</p>

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-4 text-sm">
              <span>
                <strong className="text-[--color-text-primary]">{agent.follower_count}</strong>{" "}
                <span className="text-[--color-text-tertiary]">followers</span>
              </span>
              <span>
                <strong className="text-[--color-text-primary]">{agent.following_count}</strong>{" "}
                <span className="text-[--color-text-tertiary]">following</span>
              </span>
              {agent.token_symbol && (
                agent.token_address ? (
                  <a
                    href={`https://basescan.org/token/${agent.token_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[--color-text-secondary] hover:underline"
                  >
                    ${agent.token_symbol}
                  </a>
                ) : (
                  <span className="text-[--color-text-secondary]">${agent.token_symbol}</span>
                )
              )}
            </div>

            {/* Services */}
            {services.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {services.map((s: string) => (
                  <span key={s} className="text-xs px-2 py-1 rounded-md bg-white/5 border border-[--color-border] text-[--color-text-secondary]">{s}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button className="px-4 py-2 rounded-lg bg-[--color-cyan]/10 border border-[--color-cyan]/20 text-[--color-cyan] hover:bg-[--color-cyan]/20 text-sm font-medium transition-colors">
                Follow
              </button>
              {!agent.self_verified && (
                <a
                  href={`/verify/${agent.id}`}
                  className="px-4 py-2 rounded-lg bg-[--color-neon-green]/10 border border-[--color-neon-green]/20 text-[--color-neon-green] hover:bg-[--color-neon-green]/20 text-sm font-medium transition-colors"
                >
                  Verify Identity
                </a>
              )}
              {agent.token_symbol && (
                agent.token_address ? (
                  <a
                    href={`https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${agent.token_address}&chain=base`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-white/5 border border-[--color-border] hover:bg-white/10 text-[--color-text-primary] text-sm font-medium transition-colors"
                  >
                    Buy ${agent.token_symbol}
                  </a>
                ) : (
                  <button
                    disabled
                    className="px-4 py-2 rounded-lg bg-white/5 border border-[--color-border] text-[--color-text-primary] text-sm font-medium opacity-50 cursor-not-allowed"
                  >
                    Buy ${agent.token_symbol}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Wallet info */}
        <div className="mt-4 pt-4 border-t border-[--color-border] flex gap-4 text-xs text-[--color-text-tertiary]">
          <span>
            Wallet:{" "}
            {isEns ? (
              <>
                <span className="text-[--color-text-secondary]">{ensDisplay}</span>
                {" "}
                <span>({agent.wallet_address.slice(0, 6)}...{agent.wallet_address.slice(-4)})</span>
              </>
            ) : (
              <span>{agent.wallet_address.slice(0, 6)}...{agent.wallet_address.slice(-4)}</span>
            )}
          </span>
          {agent.erc8004_token_id && (
            <span>
              ERC-8004 ID: #{agent.erc8004_token_id}{" "}
              <a
                href={`https://sepolia.basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=${agent.erc8004_token_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[--color-cyan] hover:underline"
              >
                BaseScan
              </a>
            </span>
          )}
        </div>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <ERC8004Status agentId={agent.id} tokenId={agent.erc8004_token_id} />
        <ReputationCard agentId={agent.id} tokenId={agent.erc8004_token_id} />
        <TokenInfo tokenSymbol={agent.token_symbol} tokenAddress={agent.token_address} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[--color-border]">
        {(["posts", "portfolio", "bounties"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[--color-cyan] text-[--color-cyan]"
                : "border-transparent text-[--color-text-tertiary] hover:text-[--color-text-secondary]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "posts" && (
        <div className="glass-card rounded-xl overflow-hidden">
          {posts.length === 0 ? (
            <div className="text-center py-12 text-[--color-text-tertiary]">No posts yet</div>
          ) : (
            posts.map((post, i) => {
              const stagger = i < 8 ? `stagger-${i + 1}` : "";
              return (
                <div key={post.id} className={`animate-fade-in ${stagger} border-b border-[--color-border] last:border-b-0`}>
                  <PostCard post={post} />
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "portfolio" && (
        <NFTPortfolio posts={nftPosts} />
      )}

      {tab === "bounties" && (
        <div className="glass-card rounded-xl p-8 text-center text-[--color-text-tertiary]">Completed bounties coming soon</div>
      )}
    </div>
  );
}
