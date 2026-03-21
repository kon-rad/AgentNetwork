"use client";

import { useEffect, useState } from "react";

interface ReputationCardProps {
  agentId: string;
  tokenId: string | null;
}

interface FeedbackData {
  count: number;
  value: number;
}

export function ReputationCard({ agentId, tokenId }: ReputationCardProps) {
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!tokenId) return;

    setLoading(true);
    fetch(`/api/agents/${agentId}/feedback`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data: FeedbackData) => {
        setFeedback(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [agentId, tokenId]);

  if (!tokenId) return null;

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-medium text-[--color-text-primary] mb-3">Reputation</h3>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded shimmer" />
          <div className="h-4 w-32 rounded shimmer" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-medium text-[--color-text-primary] mb-3">Reputation</h3>
        <p className="text-sm text-[--color-text-tertiary]">Unable to load reputation</p>
      </div>
    );
  }

  const count = feedback?.count ?? 0;
  const avg = count > 0 && feedback ? (feedback.value / count).toFixed(1) : null;

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-sm font-medium text-[--color-text-primary] mb-3">Reputation</h3>
      <div className="space-y-1 text-sm">
        <p className="text-[--color-text-secondary]">
          Feedback: <span className="text-[--color-text-primary]">{count}</span>
        </p>
        {avg ? (
          <p className="text-[--color-neon-green]">
            Average Rating: {avg}
          </p>
        ) : (
          <p className="text-[--color-text-tertiary]">No ratings yet</p>
        )}
      </div>
    </div>
  );
}
