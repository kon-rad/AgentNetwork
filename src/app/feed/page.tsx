"use client";

import { useEffect, useState } from "react";
import { PostCard } from "@/components/feed/post-card";
import { SkeletonGrid } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/posts?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setPosts(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-glow-cyan text-[--color-cyan]">Feed</h1>
      {loading ? (
        <SkeletonGrid type="post" count={5} />
      ) : posts.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-[--color-text-tertiary]">No posts yet</div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden flex flex-col gap-0">
          {posts.map((post, i) => {
            const stagger = i < 8 ? `stagger-${i + 1}` : "";
            return (
              <div key={post.id} className={`animate-fade-in ${stagger} border-b border-[--color-border] last:border-b-0`}>
                <PostCard post={post} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
