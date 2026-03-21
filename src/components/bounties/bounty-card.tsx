import Link from "next/link";
import type { Bounty } from "@/lib/types";

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  open: { bg: "bg-[--color-tertiary-container]/10", text: "text-[--color-tertiary-container]", border: "border-[--color-tertiary-container]/30" },
  claimed: { bg: "bg-[--color-outline-variant]/30", text: "text-[--color-outline]", border: "border-[--color-outline-variant]" },
  completed: { bg: "bg-[--color-tertiary-fixed-dim]/10", text: "text-[--color-tertiary-fixed-dim]", border: "border-[--color-tertiary-fixed-dim]/30" },
  pending_payment: { bg: "bg-[--color-secondary]/10", text: "text-[--color-secondary]", border: "border-[--color-secondary]/30" },
  payment_failed: { bg: "bg-[--color-error]/10", text: "text-[--color-error]", border: "border-[--color-error]/30" },
};

const BOUNTY_ICONS: Record<string, string> = {
  coder: "terminal",
  auditor: "shield",
  filmmaker: "videocam",
  trader: "query_stats",
  clipper: "content_cut",
  curator: "library_books",
  designer: "palette",
};

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const isClaimed = bounty.status === "claimed" || bounty.status === "completed";
  const statusStyle = STATUS_STYLES[bounty.status] || STATUS_STYLES.open;
  const icon = BOUNTY_ICONS[bounty.required_service_type || ""] || "assignment";

  return (
    <Link
      href={`/bounties/${bounty.id}`}
      className={`group relative transition-all duration-500 block ${
        isClaimed ? "opacity-60" : "skew-brief hover:!transform-none hover:scale-[1.02]"
      }`}
    >
      {!isClaimed && (
        <div className="absolute inset-0 bg-[--color-primary]/5 blur-xl group-hover:bg-[--color-primary]/10 transition-all" />
      )}
      <div className={`relative backdrop-blur-xl border p-6 corner-tick h-full flex flex-col ${
        isClaimed
          ? "bg-[--color-surface-container-lowest] border-[--color-outline-variant]/10 grayscale"
          : "bg-[--color-surface-container-low]/60 border-[--color-outline-variant]/30"
      }`}>
        {/* Status + ID */}
        <div className="flex justify-between items-start mb-6">
          <div className={`px-3 py-1 ${statusStyle.bg} border ${statusStyle.border} ${statusStyle.text} text-[10px] font-mono tracking-widest leading-none uppercase`}>
            STATUS: {bounty.status.replace("_", " ")}
          </div>
          <div className="text-right">
            <div className="text-[8px] font-mono text-[--color-outline] uppercase">Mission ID</div>
            <div className="text-xs font-mono text-[--color-primary]">#{bounty.id.slice(0, 8)}</div>
          </div>
        </div>

        {/* Icon + Title */}
        <div className="flex gap-4 mb-6">
          <div className="w-16 h-16 border border-[--color-primary]/20 bg-[--color-surface-container-lowest] flex items-center justify-center overflow-hidden">
            <span className={`material-symbols-outlined text-4xl ${isClaimed ? "text-[--color-outline-variant]" : "holographic-text"}`}>
              {icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-[family-name:var(--font-syne)] font-bold text-xl uppercase tracking-tighter leading-tight ${
              isClaimed ? "text-[--color-outline]" : "text-[--color-on-surface] group-hover:text-[--color-primary]"
            } transition-colors`}>
              {bounty.title}
            </h3>
            {bounty.creator_display_name && (
              <div className="text-[10px] font-mono text-[--color-outline-variant] mt-1 uppercase">
                Contractor: {bounty.creator_display_name}
              </div>
            )}
          </div>
        </div>

        {/* Reward */}
        {bounty.reward_amount && (
          <div className="mb-8">
            <div className="text-[10px] font-mono text-[--color-outline] uppercase mb-2">REWARD_TIER</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-mono font-black tracking-tighter ${
                isClaimed ? "text-[--color-outline-variant]" : "text-[--color-secondary] drop-shadow-lg"
              }`}>
                {bounty.reward_amount}
              </span>
              <span className={`text-lg font-mono ${isClaimed ? "text-[--color-outline-variant]" : "text-[--color-secondary]/60"}`}>
                {bounty.reward_token || "USDC"}
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto space-y-4">
          {bounty.required_service_type && (
            <div className="flex justify-between text-[10px] font-mono border-y border-[--color-outline-variant]/10 py-2">
              <span className="text-[--color-outline]">SERVICE_TYPE</span>
              <span className={isClaimed ? "text-[--color-outline-variant]" : "text-[--color-primary]"}>
                {bounty.required_service_type.toUpperCase()}
              </span>
            </div>
          )}
          {!isClaimed ? (
            <span className="block w-full py-3 bg-[--color-tertiary-container] text-[--color-on-tertiary-container] font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-widest text-sm text-center bevel-neon group-active:scale-95 transition-all">
              Claim Bounty
            </span>
          ) : (
            <span className="block w-full py-3 bg-[--color-outline-variant]/50 text-[--color-surface] font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-widest text-sm text-center">
              {bounty.status === "completed" ? "COMPLETED" : "UNAVAILABLE"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
