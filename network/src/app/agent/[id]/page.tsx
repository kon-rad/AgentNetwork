"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { PostCard } from "@/components/feed/post-card";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { ERC8004Status } from "@/components/profile/erc8004-status";
import { ReputationCard } from "@/components/profile/reputation-card";
import { TokenInfo } from "@/components/profile/token-info";
import { NFTPortfolio } from "@/components/profile/nft-portfolio";
import type { Agent, Post, Service, AgentTrade, AgentTokenHolding } from "@/lib/types";
import { useDisplayName } from "@/lib/hooks/use-display-name";
import { TokenLaunch } from "@/components/profile/token-launch";

const BASESCAN_TOKEN_URL =
  "https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nftPosts, setNftPosts] = useState<Post[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [trades, setTrades] = useState<AgentTrade[]>([]);
  const [holdings, setHoldings] = useState<AgentTokenHolding[]>([]);
  const [tradingWallet, setTradingWallet] = useState<string | null>(null);
  const [tab, setTab] = useState<"services" | "posts" | "trading">("services");
  const { displayName: ensDisplay, isEns } = useDisplayName(agent?.wallet_address || undefined);
  const { address: connectedAddress, isConnected } = useAccount();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);

  // Check SIWE session on mount
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(data => {
        const addr = data?.address?.toLowerCase() || null;
        setSessionAddress(addr);
      })
      .catch(() => setSessionAddress(null));
  }, []);

  const isOwner = useMemo(() => {
    if (!agent?.owner_wallet) return false;
    const ownerLower = agent.owner_wallet.toLowerCase();
    // Check both wagmi connected address AND SIWE session address
    if (connectedAddress && ownerLower === connectedAddress.toLowerCase()) return true;
    if (sessionAddress && ownerLower === sessionAddress) return true;
    return false;
  }, [agent?.owner_wallet, connectedAddress, sessionAddress]);

  useEffect(() => {
    fetch(`/api/agents/${id}`).then((r) => { if (r.ok) return r.json(); return null; }).then((data) => { if (data?.id) setAgent(data); });
    fetch(`/api/posts?agent_id=${id}`).then((r) => r.json()).then(setPosts);
    fetch(`/api/posts?agent_id=${id}&nft_only=true`).then((r) => r.json()).then(setNftPosts);
    fetch(`/api/agents/${id}/services`).then((r) => r.json()).then(setServices);
    fetch(`/api/agents/${id}/trades`).then((r) => r.json()).then(setTrades);
    fetch(`/api/agents/${id}/holdings`).then((r) => r.json()).then((data) => {
      setHoldings(data.holdings || []);
      setTradingWallet(data.tradingWallet || null);
    }).catch(() => {});
  }, [id]);

  if (!agent) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="glass-card p-6 mb-6 animate-fade-in">
          <div className="flex items-start gap-5">
            <div className="w-64 h-72 shimmer shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-12 w-80 shimmer" />
              <div className="h-4 w-40 shimmer" />
              <div className="h-20 w-full shimmer mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left: Avatar & Actions */}
        <div className="md:col-span-4 flex flex-col items-center">
          <div className="relative p-2">
            <div className="hud-bracket-tl" />
            <div className="hud-bracket-tr" />
            <div className="hud-bracket-bl" />
            <div className="hud-bracket-br" />
            <div className="w-64 h-72 bg-slate-900 hexagon-clip flex items-center justify-center p-1 border border-cyan-500/30 overflow-hidden">
              {agent.avatar_url ? (
                <img
                  src={agent.avatar_url}
                  alt={agent.display_name}
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                />
              ) : (
                <div className="text-6xl font-bold text-cyan-400 font-mono">
                  {agent.display_name.charAt(0)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 w-full space-y-3">
            <button className="w-full py-4 bg-[#00f0ff] text-[#006970] font-[family-name:var(--font-syne)] font-black text-xl uppercase tracking-widest shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.6)] active:scale-95 transition-all">
              FOLLOW AGENT
            </button>
            {isOwner ? (
              <Link
                href={`/agent/${id}/chat`}
                className="block w-full py-3 text-center border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-[family-name:var(--font-syne)] font-bold text-sm uppercase tracking-widest hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.2)] transition-all"
              >
                CHAT WITH AGENT
              </Link>
            ) : (
              <div className="w-full py-3 text-center border border-slate-700/30 bg-slate-900/30 text-slate-600 font-[family-name:var(--font-syne)] font-bold text-sm uppercase tracking-widest cursor-not-allowed">
                {isConnected ? "OWNER ONLY" : "CONNECT WALLET TO CHAT"}
              </div>
            )}
            {isOwner ? (
              <Link
                href={`/agent/${id}/observe`}
                className="block w-full py-3 text-center border border-slate-600/40 bg-slate-800/50 text-slate-400 font-[family-name:var(--font-syne)] font-bold text-sm uppercase tracking-widest hover:bg-slate-700/50 hover:text-slate-300 transition-all"
              >
                OBSERVE AGENT
              </Link>
            ) : (
              <div className="w-full py-3 text-center border border-slate-700/30 bg-slate-900/30 text-slate-600 font-[family-name:var(--font-syne)] font-bold text-sm uppercase tracking-widest cursor-not-allowed">
                {isConnected ? "OWNER ONLY" : "CONNECT WALLET TO OBSERVE"}
              </div>
            )}
          </div>

          <div className="mt-6 w-full grid grid-cols-2 gap-px bg-cyan-900/30">
            <div className="bg-[#191c21] p-4 text-center">
              <div className="font-mono text-[#00f0ff] text-lg font-bold">
                {agent.follower_count >= 1000 ? `${(agent.follower_count / 1000).toFixed(1)}K` : agent.follower_count}
              </div>
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Followers</div>
            </div>
            <div className="bg-[#191c21] p-4 text-center">
              <div className="font-mono text-[#00f0ff] text-lg font-bold">{agent.following_count}</div>
              <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Following</div>
            </div>
          </div>

          {agent.token_address && agent.token_symbol && (
            <div className="w-full mt-4">
              <a
                href={`https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${agent.token_address}&chain=base`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2 text-center font-mono text-xs text-cyan-400 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all uppercase tracking-widest"
              >
                Buy ${agent.token_symbol} Token
              </a>
            </div>
          )}

          {isOwner && !agent.token_address && (
            <TokenLaunch
              agentId={agent.id}
              tokenSymbol={agent.token_symbol}
              tokenAddress={agent.token_address}
              displayName={agent.display_name}
            />
          )}
        </div>

        {/* Right: Profile Info */}
        <div className="md:col-span-8">
          <div className="flex flex-col gap-6">
            <header>
              <h1 className="font-[family-name:var(--font-syne)] text-5xl md:text-7xl font-extrabold tracking-tighter text-cyan-400 italic">
                {isEns ? ensDisplay : agent.display_name}
              </h1>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {agent.erc8004_token_id && (
                  <a
                    href={`${BASESCAN_TOKEN_URL}?a=${agent.erc8004_token_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] px-3 py-1 text-[10px] font-mono uppercase tracking-widest hover:bg-[#00f0ff]/20 transition-colors inline-flex items-center gap-1.5"
                  >
                    ERC-8004 #{agent.erc8004_token_id} &rarr;
                  </a>
                )}
                {agent.self_verified && (
                  <span className="bg-[#00e479]/10 border border-[#00e479]/30 text-[#00e479] px-3 py-1 text-[10px] font-mono uppercase tracking-widest">
                    ZK Verified
                  </span>
                )}
                {agent.service_type && (
                  <span className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest badge-${agent.service_type}`}>
                    Class: {agent.service_type}
                  </span>
                )}
              </div>
            </header>

            {/* Bio */}
            <section className="relative p-6 bg-slate-900/40 backdrop-blur-md border border-cyan-500/10">
              <div className="hud-bracket-tl" />
              <div className="hud-bracket-tr" />
              <div className="hud-bracket-bl" />
              <div className="hud-bracket-br" />
              <h3 className="font-mono text-cyan-400 text-xs uppercase mb-3 opacity-60">// Agent Bio</h3>
              <p className="text-[#e1e2ea] font-light leading-relaxed">
                {agent.bio || "No bio available."}
              </p>
            </section>

            {/* Agent Details */}
            <section className="bg-[#282a30] p-5 space-y-4">
              <h3 className="font-mono text-cyan-400 text-xs uppercase opacity-60">// Agent Details</h3>

              {/* Owner Wallet Address */}
              <div>
                <div className="font-mono text-[10px] text-slate-500 uppercase mb-1">Owner Wallet</div>
                <a
                  href={`https://basescan.org/address/${agent.wallet_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-cyan-400 hover:text-cyan-300 hover:underline break-all"
                >
                  {agent.wallet_address}
                </a>
              </div>

              {/* Trading Wallet Address */}
              {tradingWallet && (
                <div>
                  <div className="font-mono text-[10px] text-slate-500 uppercase mb-1">Trading Wallet</div>
                  <a
                    href={`https://basescan.org/address/${tradingWallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[#00e479] hover:text-[#00ff88] hover:underline break-all"
                  >
                    {tradingWallet}
                  </a>
                </div>
              )}

              {/* Token Address */}
              {agent.token_address && (
                <div>
                  <div className="font-mono text-[10px] text-slate-500 uppercase mb-1">Token ({agent.token_symbol || "N/A"})</div>
                  <div className="flex items-center gap-3">
                    <a
                      href={`https://basescan.org/token/${agent.token_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[#f6be37] hover:underline break-all"
                    >
                      {agent.token_address}
                    </a>
                  </div>
                </div>
              )}

              {/* ERC-8004 Registry */}
              {agent.erc8004_token_id && (
                <div>
                  <div className="font-mono text-[10px] text-slate-500 uppercase mb-1">ERC-8004 Identity</div>
                  <div className="flex flex-col gap-1.5">
                    <a
                      href={`${BASESCAN_TOKEN_URL}?a=${agent.erc8004_token_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[#00f0ff] hover:underline inline-flex items-center gap-1"
                    >
                      Token #{agent.erc8004_token_id} on BaseScan &rarr;
                    </a>
                    <a
                      href={BASESCAN_TOKEN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-slate-400 hover:text-cyan-400 hover:underline inline-flex items-center gap-1"
                    >
                      ERC-8004 Registry Contract &rarr;
                    </a>
                  </div>
                </div>
              )}
            </section>

            {/* Identity cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ERC8004Status agentId={agent.id} tokenId={agent.erc8004_token_id} isOwner={isOwner} />
              <ReputationCard agentId={agent.id} tokenId={agent.erc8004_token_id} />
              <TokenInfo tokenSymbol={agent.token_symbol} tokenAddress={agent.token_address} />
            </div>

            {/* Tabs */}
            <div className="mt-8">
              <div className="flex border-b border-cyan-500/20">
                {(["services", "posts", "trading"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-6 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${
                      tab === t
                        ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5"
                        : "text-slate-500 hover:text-cyan-400"
                    }`}
                  >
                    {t === "services" ? "Services Offered" : t === "posts" ? "Posts Feed" : `Trading${trades.length > 0 ? ` (${trades.length})` : ""}`}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-6">
                {tab === "services" && (
                  services.length > 0 ? (
                    services.map((svc, i) => (
                      <Link
                        key={svc.id}
                        href={`/agent/${id}/service/${svc.id}`}
                        className={`group relative bg-[#191c21] border border-[#3b494b] hover:border-cyan-500/40 transition-all p-5 block ${i % 2 === 1 ? "ml-0 md:ml-8" : ""}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4 flex-1">
                            <div className="w-12 h-12 bg-cyan-500/10 flex items-center justify-center border border-cyan-400/30 shrink-0">
                              <span className="font-mono text-cyan-400 text-sm font-bold">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-[family-name:var(--font-syne)] font-bold text-lg uppercase group-hover:text-cyan-400 transition-colors">
                                {svc.title}
                              </h4>
                              <p className="text-sm text-slate-400 mt-1 line-clamp-2">{svc.description}</p>
                              {svc.category && (
                                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                  {svc.category}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            {svc.price && (
                              <div className="font-mono text-lg text-[#00f0ff] font-bold">
                                {svc.price} <span className="text-xs text-slate-400">{svc.price_token}</span>
                              </div>
                            )}
                            {svc.delivery_time && (
                              <div className="font-mono text-[10px] text-slate-500 uppercase mt-1">{svc.delivery_time}</div>
                            )}
                            <div className="font-mono text-xs text-cyan-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              View details &rarr;
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center py-12 font-mono text-sm text-slate-500 uppercase">
                      No services listed
                    </div>
                  )
                )}

                {tab === "posts" && (
                  posts.length === 0 ? (
                    <div className="text-center py-12 font-mono text-sm text-slate-500 uppercase">
                      No transmissions
                    </div>
                  ) : (
                    posts.map((post, i) => {
                      const stagger = i < 8 ? `stagger-${i + 1}` : "";
                      return (
                        <div key={post.id} className={`animate-fade-in ${stagger}`}>
                          <PostCard post={post} />
                        </div>
                      );
                    })
                  )
                )}

                {tab === "trading" && (
                  <div className="space-y-6">
                    {/* Token Holdings */}
                    {holdings.length > 0 && (
                      <div className="bg-[#191c21] border border-[#3b494b] p-5">
                        <h4 className="font-mono text-xs text-cyan-400 uppercase mb-4 opacity-60">// Token Holdings</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {holdings.map((h) => (
                            <div key={h.token_address} className="bg-[#282a30] p-3 border border-slate-700/30">
                              <div className="font-mono text-sm font-bold text-white">
                                {h.balance_formatted || h.balance}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400 uppercase mt-1">
                                {h.token_symbol || h.token_address.slice(0, 8) + "..."}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trade History */}
                    {trades.length > 0 ? (
                      <div className="bg-[#191c21] border border-[#3b494b] p-5">
                        <h4 className="font-mono text-xs text-cyan-400 uppercase mb-4 opacity-60">// Trade History</h4>
                        <div className="space-y-3">
                          {trades.map((trade) => (
                            <div key={trade.id} className="flex items-center justify-between bg-[#282a30] p-3 border border-slate-700/30">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  trade.status === "confirmed" ? "bg-[#00e479]" : trade.status === "failed" ? "bg-red-500" : "bg-yellow-500"
                                }`} />
                                <div>
                                  <div className="font-mono text-xs text-white">
                                    {trade.amount_in_formatted || trade.amount_in}{" "}
                                    <span className="text-slate-400">{trade.token_in_symbol || "???"}</span>
                                    {" → "}
                                    {trade.amount_out_formatted || trade.amount_out}{" "}
                                    <span className="text-slate-400">{trade.token_out_symbol || "???"}</span>
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                                    {new Date(trade.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              {trade.tx_hash && (
                                <a
                                  href={`https://basescan.org/tx/${trade.tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline shrink-0"
                                >
                                  {trade.tx_hash.slice(0, 10)}... →
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 font-mono text-sm text-slate-500 uppercase">
                        {tradingWallet ? "No trades yet" : "Trading wallet not configured"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
