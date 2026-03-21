"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Bounty } from "@/lib/types";

function TransactionStatus({ txHash, status }: { txHash: string | null; status: string }) {
  if (!txHash) return null;

  const statusConfig: Record<string, { label: string; color: string }> = {
    completed: { label: "Confirmed", color: "text-green-300" },
    pending_payment: { label: "Pending", color: "text-yellow-300" },
    payment_failed: { label: "Failed", color: "text-red-300" },
  };

  const config = statusConfig[status] || { label: status, color: "text-zinc-400" };
  const truncatedHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  const basescanUrl = `https://sepolia.basescan.org/tx/${txHash}`;

  return (
    <div className="mt-4 p-4 bg-zinc-900/80 border border-zinc-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Payment Status</p>
          <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 mb-1">Transaction</p>
          <code className="text-xs font-mono text-zinc-400">{truncatedHash}</code>
        </div>
      </div>
      <a
        href={basescanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        View on BaseScan &rarr;
      </a>
    </div>
  );
}

export default function BountyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [bounty, setBounty] = useState<Bounty | null>(null);

  useEffect(() => {
    fetch(`/api/bounties?limit=100`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.find((b: Bounty) => b.id === id);
        setBounty(found || null);
      });
  }, [id]);

  if (!bounty) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/bounties" className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block">
        &larr; Back to bounties
      </Link>

      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{bounty.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                bounty.status === "open" ? "bg-green-500/20 text-green-300" :
                bounty.status === "claimed" ? "bg-yellow-500/20 text-yellow-300" :
                bounty.status === "pending_payment" ? "bg-yellow-500/20 text-yellow-300" :
                bounty.status === "payment_failed" ? "bg-red-500/20 text-red-300" :
                bounty.status === "completed" ? "bg-green-500/20 text-green-300" :
                "bg-zinc-500/20 text-zinc-400"
              }`}>
                {bounty.status === "pending_payment" ? "pending payment" :
                 bounty.status === "payment_failed" ? "payment failed" :
                 bounty.status}
              </span>
              {bounty.required_service_type && (
                <span className="text-sm text-zinc-500">
                  Looking for: <span className="text-zinc-300 capitalize">{bounty.required_service_type}</span>
                </span>
              )}
            </div>
          </div>
          {bounty.reward_amount && (
            <div className="text-right">
              <p className="text-2xl font-bold">{bounty.reward_amount}</p>
              <p className="text-sm text-zinc-500">{bounty.reward_token || "USDC"}</p>
            </div>
          )}
        </div>

        <p className="text-zinc-300 mt-4 whitespace-pre-wrap">{bounty.description}</p>

        <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            Posted by <span className="text-zinc-300">{bounty.creator_display_name || "Unknown"}</span>
          </div>
          {bounty.status === "open" && (
            <button className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium transition-colors">
              Claim Bounty
            </button>
          )}
        </div>

        {bounty.claimed_by_display_name && (
          <div className="mt-4 p-3 rounded-lg bg-zinc-900 text-sm">
            Claimed by <span className="text-white font-medium">{bounty.claimed_by_display_name}</span>
          </div>
        )}

        <TransactionStatus txHash={bounty.tx_hash} status={bounty.status} />
      </div>
    </div>
  );
}
