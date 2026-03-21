import Link from "next/link";
import type { Bounty } from "@/lib/types";

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  open: { bg: "bg-[#00f985]/10", text: "text-[#00f985]", border: "border-[#00f985]/30" },
  claimed: { bg: "bg-[#3b494b]/30", text: "text-[#849495]", border: "border-[#3b494b]" },
  completed: { bg: "bg-[#00e479]/10", text: "text-[#00e479]", border: "border-[#00e479]/30" },
  pending_payment: { bg: "bg-[#f6be37]/10", text: "text-[#f6be37]", border: "border-[#f6be37]/30" },
  payment_failed: { bg: "bg-[#ffb4ab]/10", text: "text-[#ffb4ab]", border: "border-[#ffb4ab]/30" },
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
        <div className="absolute inset-0 bg-[#dbfcff]/5 blur-xl group-hover:bg-[#dbfcff]/10 transition-all" />
      )}
      <div className={`relative backdrop-blur-xl border p-6 corner-tick h-full flex flex-col ${
        isClaimed
          ? "bg-[#0c0e13] border-[#3b494b]/10 grayscale"
          : "bg-[#191c21]/60 border-[#3b494b]/30"
      }`}>
        {/* Status + ID */}
        <div className="flex justify-between items-start mb-6">
          <div className={`px-3 py-1 ${statusStyle.bg} border ${statusStyle.border} ${statusStyle.text} text-[10px] font-mono tracking-widest leading-none uppercase`}>
            STATUS: {bounty.status.replace("_", " ")}
          </div>
          <div className="text-right">
            <div className="text-[8px] font-mono text-[#849495] uppercase">Mission ID</div>
            <div className="text-xs font-mono text-[#dbfcff]">#{bounty.id.slice(0, 8)}</div>
          </div>
        </div>

        {/* Icon + Title */}
        <div className="flex gap-4 mb-6">
          <div className="w-16 h-16 border border-[#dbfcff]/20 bg-[#0c0e13] flex items-center justify-center overflow-hidden">
            <span className={`material-symbols-outlined text-4xl ${isClaimed ? "text-[#3b494b]" : "holographic-text"}`}>
              {icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-[family-name:var(--font-syne)] font-bold text-xl uppercase tracking-tighter leading-tight ${
              isClaimed ? "text-[#849495]" : "text-[#e1e2ea] group-hover:text-[#dbfcff]"
            } transition-colors`}>
              {bounty.title}
            </h3>
            {bounty.creator_display_name && (
              <div className="text-[10px] font-mono text-[#3b494b] mt-1 uppercase">
                Contractor: {bounty.creator_display_name}
              </div>
            )}
          </div>
        </div>

        {/* Reward */}
        {bounty.reward_amount && (
          <div className="mb-8">
            <div className="text-[10px] font-mono text-[#849495] uppercase mb-2">REWARD_TIER</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-mono font-black tracking-tighter ${
                isClaimed ? "text-[#3b494b]" : "text-[#f6be37] drop-shadow-lg"
              }`}>
                {bounty.reward_amount}
              </span>
              <span className={`text-lg font-mono ${isClaimed ? "text-[#3b494b]" : "text-[#f6be37]/60"}`}>
                {bounty.reward_token || "USDC"}
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto space-y-4">
          {bounty.required_service_type && (
            <div className="flex justify-between text-[10px] font-mono border-y border-[#3b494b]/10 py-2">
              <span className="text-[#849495]">SERVICE_TYPE</span>
              <span className={isClaimed ? "text-[#3b494b]" : "text-[#dbfcff]"}>
                {bounty.required_service_type.toUpperCase()}
              </span>
            </div>
          )}
          {!isClaimed ? (
            <span className="block w-full py-3 bg-[#00f985] text-[#006d37] font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-widest text-sm text-center bevel-neon group-active:scale-95 transition-all">
              Claim Bounty
            </span>
          ) : (
            <span className="block w-full py-3 bg-[#3b494b]/50 text-[#111319] font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-widest text-sm text-center">
              {bounty.status === "completed" ? "COMPLETED" : "UNAVAILABLE"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
