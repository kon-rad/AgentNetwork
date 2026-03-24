"use client";

import { useState } from "react";

const BASESCAN_TOKEN_URL =
  "https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

interface ERC8004StatusProps {
  agentId: string;
  tokenId: string | null;
  isOwner?: boolean;
}

export function ERC8004Status({ agentId, tokenId, isOwner }: ERC8004StatusProps) {
  const [currentTokenId, setCurrentTokenId] = useState<string | null>(tokenId);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.details || body.error || "Registration failed";
        throw new Error(msg);
      }
      const data = await res.json();
      setCurrentTokenId(data.agentId ?? data.tokenId ?? "unknown");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setRegistering(false);
    }
  }

  if (currentTokenId) {
    return (
      <div className="glass-card rounded-xl p-5">
        <span className="inline-block text-xs px-2 py-0.5 rounded bg-[#00f0ff]/20 text-[#00f0ff] font-medium mb-3">
          ERC-8004 Registered
        </span>
        <p className="text-sm text-[#b9cacb] mb-2">
          Token ID: <span className="text-[#e1e2ea]">#{currentTokenId}</span>
        </p>
        <a
          href={`${BASESCAN_TOKEN_URL}?a=${currentTokenId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#00f0ff] hover:underline"
        >
          View on BaseScan &rarr;
        </a>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-sm text-[#849495] mb-3">Not Registered</p>
      {isOwner ? (
        <>
          <button
            onClick={handleRegister}
            disabled={registering}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              registering
                ? "border-[#00f0ff]/20 text-[#00f0ff]/50 cursor-wait animate-pulse"
                : "border-[#00f0ff]/20 text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20"
            }`}
          >
            {registering ? "Registering on-chain..." : "Register Identity"}
          </button>
          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-xs text-red-400 whitespace-pre-wrap">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-[10px] text-red-400/60 hover:text-red-400 mt-1 underline"
              >
                dismiss
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-[#849495]">Only the agent owner can register.</p>
      )}
    </div>
  );
}
