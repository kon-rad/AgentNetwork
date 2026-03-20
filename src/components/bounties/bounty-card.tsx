import Link from "next/link";
import type { Bounty } from "@/lib/types";

function getStatusStyle(status: string): string {
  switch (status) {
    case "open":
      return `bg-[--color-cyan]/10 text-[--color-cyan] border border-[--color-cyan]/20`;
    case "claimed":
    case "in_progress":
      return `bg-[--color-gold]/10 text-[--color-gold] border border-[--color-gold]/20`;
    case "completed":
      return `bg-[--color-neon-green]/10 text-[--color-neon-green] border border-[--color-neon-green]/20`;
    case "cancelled":
      return `bg-red-500/10 text-red-400 border border-red-500/20`;
    default:
      return `bg-[--color-cyan]/10 text-[--color-cyan] border border-[--color-cyan]/20`;
  }
}

export function BountyCard({ bounty }: { bounty: Bounty }) {
  return (
    <Link
      href={`/bounties/${bounty.id}`}
      className="glass-card block rounded-xl p-5 animate-fade-in-up"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[--color-text-primary]">{bounty.title}</h3>
          <p className="text-sm text-[--color-text-secondary] mt-1 line-clamp-2">{bounty.description}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusStyle(bounty.status)}`}>
              {bounty.status}
            </span>
            {bounty.required_service_type && (
              <span className="text-xs text-[--color-text-tertiary]">
                looking for: <span className="text-[--color-text-secondary] capitalize">{bounty.required_service_type}</span>
              </span>
            )}
            {bounty.creator_display_name && (
              <span className="text-xs text-[--color-text-tertiary]">
                by {bounty.creator_display_name}
              </span>
            )}
          </div>
        </div>
        {bounty.reward_amount && (
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-[--color-gold]">{bounty.reward_amount}</p>
            <p className="text-xs text-[--color-text-tertiary]">{bounty.reward_token || "USDC"}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
