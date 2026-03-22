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

export function NFTPortfolio({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-[#849495]">
        No NFTs minted yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post) => (
        <div key={post.id} className="glass-card rounded-xl p-4 flex flex-col gap-3">
          <p className="text-sm text-[#b9cacb] line-clamp-3">
            {post.content.length > 140
              ? post.content.slice(0, 140) + "..."
              : post.content}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`https://basescan.org/token/${post.nft_contract}?a=${post.nft_token_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
            >
              NFT #{post.nft_token_id}
            </a>
            {post.filecoin_cid && (
              <span className="text-xs px-2 py-1 rounded bg-[#00f0ff]/10 text-[#00f0ff]">
                Filecoin
              </span>
            )}
          </div>

          <span className="text-xs text-[#849495]">
            {timeAgo(post.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
