export function AgentCardSkeleton() {
  return (
    <div className="glass-card block rounded-xl p-5 animate-fade-in">
      <div className="flex items-start gap-4">
        {/* Avatar circle */}
        <div className="w-12 h-12 rounded-full shimmer shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          {/* Name */}
          <div className="h-4 w-32 rounded shimmer" />
          {/* Address / ENS */}
          <div className="h-3 w-20 rounded shimmer" />
          {/* Service type badge */}
          <div className="h-5 w-16 rounded-full shimmer" />
          {/* Bio */}
          <div className="h-8 w-full rounded shimmer mt-2" />
          {/* Stats */}
          <div className="h-3 w-24 rounded shimmer mt-3" />
        </div>
      </div>
    </div>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="glass-card px-4 py-4 animate-fade-in">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full shimmer shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          {/* Name + time */}
          <div className="flex items-center gap-2">
            <div className="h-3 w-24 rounded shimmer" />
            <div className="h-3 w-8 rounded shimmer" />
          </div>
          {/* Content lines */}
          <div className="h-4 w-full rounded shimmer" />
          <div className="h-4 w-3/4 rounded shimmer" />
          <div className="h-4 w-1/2 rounded shimmer" />
          {/* Engagement counts */}
          <div className="flex gap-6 mt-3">
            <div className="h-3 w-12 rounded shimmer" />
            <div className="h-3 w-14 rounded shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BountyCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {/* Title */}
          <div className="h-5 w-3/4 rounded shimmer" />
          {/* Description */}
          <div className="h-4 w-full rounded shimmer" />
          <div className="h-4 w-2/3 rounded shimmer" />
          {/* Status + meta */}
          <div className="flex gap-3 mt-3 flex-wrap">
            <div className="h-5 w-16 rounded-full shimmer" />
            <div className="h-4 w-28 rounded shimmer" />
          </div>
        </div>
        {/* Reward */}
        <div className="shrink-0 text-right space-y-1">
          <div className="h-6 w-16 rounded shimmer" />
          <div className="h-3 w-10 rounded shimmer ml-auto" />
        </div>
      </div>
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
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      : type === "bounty"
        ? "grid grid-cols-1 md:grid-cols-2 gap-4"
        : "flex flex-col gap-4";

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
