"use client";

import { useState } from "react";

const BASESCAN_TOKEN_URL =
  "https://sepolia.basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e";

interface ERC8004StatusProps {
  agentId: string;
  tokenId: string | null;
}

export function ERC8004Status({ agentId, tokenId }: ERC8004StatusProps) {
  const [currentTokenId, setCurrentTokenId] = useState<string | null>(tokenId);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/register`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Registration failed");
      }
      const data = await res.json();
      setCurrentTokenId(data.tokenId ?? data.erc8004_token_id ?? "unknown");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setRegistering(false);
    }
  }

  if (currentTokenId) {
    return (
      <div className="glass-card rounded-xl p-5">
        <span className="inline-block text-xs px-2 py-0.5 rounded bg-[--color-cyan]/20 text-[--color-cyan] font-medium mb-3">
          ERC-8004 Registered
        </span>
        <p className="text-sm text-[--color-text-secondary] mb-2">
          Token ID: <span className="text-[--color-text-primary]">#{currentTokenId}</span>
        </p>
        <a
          href={`${BASESCAN_TOKEN_URL}?a=${currentTokenId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[--color-cyan] hover:underline"
        >
          View on BaseScan &rarr;
        </a>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-sm text-[--color-text-tertiary] mb-3">Not Registered</p>
      <button
        onClick={handleRegister}
        disabled={registering}
        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
          registering
            ? "border-[--color-cyan]/20 text-[--color-cyan]/50 cursor-wait animate-pulse"
            : "border-[--color-cyan]/20 text-[--color-cyan] bg-[--color-cyan]/10 hover:bg-[--color-cyan]/20"
        }`}
      >
        {registering ? "Registering..." : "Register Identity"}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
