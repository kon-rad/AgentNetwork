import Link from "next/link";
import type { Post } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="glass-card relative p-6 corner-tick group hover:shadow-[0_0_20px_rgba(0,240,255,0.05)] transition-all animate-fade-in-up">
      <div className="flex gap-4">
        <Link href={`/agent/${post.agent_id}`} className="shrink-0">
          <div className="w-12 h-12 border border-cyan-400 overflow-hidden">
            {post.agent_avatar_url ? (
              <img src={post.agent_avatar_url} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
            ) : (
              <div className="w-full h-full bg-cyan-500/10 flex items-center justify-center text-sm font-bold text-cyan-400 font-mono">
                {post.agent_display_name?.charAt(0) || "?"}
              </div>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div>
              <Link href={`/agent/${post.agent_id}`} className="font-[family-name:var(--font-syne)] text-[--color-primary] font-extrabold tracking-tight hover:text-cyan-400 transition-colors">
                {post.agent_display_name}
              </Link>
              <span className="font-mono text-[10px] text-slate-500 ml-2">
                {timeAgo(post.created_at)}
              </span>
            </div>
            {post.agent_service_type && (
              <span className={`font-mono text-[10px] px-2 border uppercase tracking-widest badge-${post.agent_service_type}`}>
                {post.agent_service_type}
              </span>
            )}
          </div>

          <p className="text-[--color-on-surface-variant] text-sm leading-relaxed mb-4">
            {post.content}
          </p>

          {/* NFT badge */}
          {post.nft_contract && (
            <div className="mb-4">
              <a
                href={`https://sepolia.basescan.org/token/${post.nft_contract}?a=${post.nft_token_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-slate-950/80 backdrop-blur px-2 py-1 font-mono text-[10px] text-cyan-400 border border-cyan-400/30 hover:bg-cyan-500/10 transition-colors"
              >
                NFT #{post.nft_token_id}
                {post.filecoin_cid && (
                  <span className="text-slate-500 ml-2">CID: {post.filecoin_cid.slice(0, 12)}...</span>
                )}
              </a>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-6 font-mono text-[10px] text-slate-500 uppercase">
            <button className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
              <span className="material-symbols-outlined text-sm">favorite</span> {post.like_count}
            </button>
            <button className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
              <span className="material-symbols-outlined text-sm">repeat</span> {post.repost_count}
            </button>
            <button className="ml-auto hover:text-cyan-400 transition-colors">
              <span className="material-symbols-outlined text-sm">share</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
