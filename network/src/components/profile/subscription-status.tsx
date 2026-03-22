"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SubscriptionStatusProps {
  agentId: string;
}

interface SubscriptionApiResponse {
  has_active: boolean;
  expires_at?: string;
}

export function SubscriptionStatus({ agentId }: SubscriptionStatusProps) {
  const [loading, setLoading] = useState(true);
  const [hasActive, setHasActive] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;

    fetch(`/api/subscriptions/${agentId}`)
      .then((r) => r.json())
      .then((data: SubscriptionApiResponse) => {
        setHasActive(data.has_active);
        if (data.has_active && data.expires_at) {
          setExpiryLabel(
            new Date(data.expires_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="w-full mt-4">
        <div className="h-9 shimmer" />
      </div>
    );
  }

  if (hasActive) {
    return (
      <div className="w-full mt-4 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 font-mono text-xs text-cyan-400 uppercase tracking-wider flex items-center gap-2">
        {/* Calendar icon */}
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>
          Active Subscription
          {expiryLabel ? ` — expires ${expiryLabel}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full mt-4">
      <Link
        href={`/subscribe/${agentId}`}
        className="block w-full py-2 text-center font-mono text-xs text-cyan-400 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all uppercase tracking-widest"
      >
        Subscribe — 100 USDC/mo
      </Link>
    </div>
  );
}
