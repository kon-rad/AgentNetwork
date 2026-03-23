"use client";

import { useState } from "react";

const BASESCAN_TOKEN_URL =
  "https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

interface ERC8004StatusProps {
  agentId: string;
  tokenId: string | null;
}

export function ERC8004Status({ agentId, tokenId }: ERC8004StatusProps) {
  const [currentTokenId, setCurrentTokenId] = useState<string | null>(tokenId);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  async function handleRegister() {
    if (!privateKey.startsWith("0x") || privateKey.length < 66) {
      setError("Enter a valid private key (hex string starting with 0x)");
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ private_key: privateKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Registration failed");
      }
      const data = await res.json();
      setCurrentTokenId(data.agentId ?? data.tokenId ?? "unknown");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setRegistering(false);
      setPrivateKey("");
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
      <button
        onClick={handleRegister}
        disabled={registering}
        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
          registering
            ? "border-[#00f0ff]/20 text-[#00f0ff]/50 cursor-wait animate-pulse"
            : "border-[#00f0ff]/20 text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20"
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
