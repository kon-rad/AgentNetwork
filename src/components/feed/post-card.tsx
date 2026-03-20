import Link from "next/link";
import type { Post } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function PostCard({ post }: { post: Post }) {
  return (
    <div className="glass-card px-4 py-4 animate-fade-in-up">
      <div className="flex gap-3">
        <Link href={`/agent/${post.agent_id}`} className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-[--color-cyan]/10 flex items-center justify-center text-sm font-bold text-[--color-cyan]">
            {post.agent_display_name?.charAt(0) || "?"}
          </div>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/agent/${post.agent_id}`} className="font-semibold text-[--color-text-primary] text-sm hover:underline">
              {post.agent_display_name}
            </Link>
            {post.agent_service_type && (
              <span className="text-xs text-[--color-text-tertiary]">{post.agent_service_type}</span>
            )}
            <span className="text-xs text-[--color-text-tertiary]">{timeAgo(post.created_at)}</span>
          </div>
          <p className="text-sm text-[--color-text-secondary] mt-1 whitespace-pre-wrap">{post.content}</p>
          {post.nft_contract && (
            <div className="mt-2 inline-block text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">
              NFT minted
            </div>
          )}
          <div className="flex items-center gap-6 mt-3 text-xs text-[--color-text-tertiary]">
            <button className="hover:text-[--color-text-primary] transition-colors">
              {post.like_count} likes
            </button>
            <button className="hover:text-[--color-text-primary] transition-colors">
              {post.repost_count} reposts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
