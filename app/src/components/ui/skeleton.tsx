export function AgentCardSkeleton() {
  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 p-5 animate-fade-in">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 hexagon-clip shimmer shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 shimmer" />
          <div className="h-5 w-32 shimmer" />
          <div className="h-4 w-16 shimmer" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-cyan-900/30 pt-4 mb-6">
        <div className="h-6 shimmer" />
        <div className="h-6 shimmer" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-10 shimmer" />
        <div className="w-10 h-10 shimmer" />
      </div>
    </div>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="glass-card relative p-6 corner-tick animate-fade-in">
      <div className="flex gap-4">
        <div className="w-12 h-12 shimmer shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 shimmer" />
            <div className="h-3 w-12 shimmer" />
          </div>
          <div className="h-4 w-full shimmer" />
          <div className="h-4 w-3/4 shimmer" />
          <div className="flex gap-6 mt-3">
            <div className="h-3 w-12 shimmer" />
            <div className="h-3 w-14 shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BountyCardSkeleton() {
  return (
    <div className="bg-[#191c21]/60 backdrop-blur-xl border border-[#3b494b]/30 p-6 corner-tick relative animate-fade-in">
      <div className="flex justify-between mb-6">
        <div className="h-5 w-24 shimmer" />
        <div className="h-4 w-20 shimmer" />
      </div>
      <div className="flex gap-4 mb-6">
        <div className="w-16 h-16 shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-3/4 shimmer" />
          <div className="h-3 w-1/2 shimmer" />
        </div>
      </div>
      <div className="mb-8 space-y-2">
        <div className="h-3 w-20 shimmer" />
        <div className="h-8 w-28 shimmer" />
      </div>
      <div className="h-12 shimmer" />
    </div>
  );
}

interface SkeletonGridProps {
  count?: number;
  type: "agent" | "post" | "bounty";
}

export function SkeletonGrid({ count = 6, type }: SkeletonGridProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  const gridClass =
    type === "agent"
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      : type === "bounty"
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        : "flex flex-col gap-6";

  return (
    <div className={gridClass}>
      {items.map((i) => {
        const staggerClass = i < 8 ? `stagger-${i + 1}` : "";
        if (type === "agent") {
          return (
            <div key={i} className={`animate-fade-in ${staggerClass}`}>
              <AgentCardSkeleton />
            </div>
          );
        }
        if (type === "post") {
          return (
            <div key={i} className={`animate-fade-in ${staggerClass}`}>
              <PostCardSkeleton />
            </div>
          );
        }
        return (
          <div key={i} className={`animate-fade-in ${staggerClass}`}>
            <BountyCardSkeleton />
          </div>
        );
      })}
    </div>
  );
}
