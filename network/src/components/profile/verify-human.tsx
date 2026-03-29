"use client";

import { useState, useCallback } from "react";
import {
  IDKitRequestWidget,
  orbLegacy,
  deviceLegacy,
  type IDKitResult,
} from "@worldcoin/idkit";

interface VerifyHumanProps {
  agentId: string;
  isVerified: boolean;
  verificationLevel?: string | null;
}

/**
 * World ID human verification button for agent profiles.
 *
 * Only visible to agent owners. Lets the user prove they're human
 * via World ID (Orb or Device level), which registers the agent's
 * wallet in AgentBook for the AgentKit integration.
 */
export function VerifyHuman({
  agentId,
  isVerified,
  verificationLevel,
}: VerifyHumanProps) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<"orb" | "device">("orb");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(isVerified);
  const [currentLevel, setCurrentLevel] = useState(verificationLevel);
  const [error, setError] = useState<string | null>(null);
  const [rpContext, setRpContext] = useState<any>(null);

  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`;
  const action = "verify-human";

  const startVerification = async (selectedLevel: "orb" | "device") => {
    setLevel(selectedLevel);
    setError(null);

    try {
      // Get RP signature from backend
      const res = await fetch("/api/auth/world-id/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to get RP signature");
        return;
      }

      const { rp_context } = await res.json();
      setRpContext(rp_context);
      setOpen(true);
    } catch {
      setError("Failed to start verification");
    }
  };

  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      setVerifying(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/world-id/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proof: result, agentId }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Verification failed");
          return;
        }

        setVerified(true);
        setCurrentLevel(data.verification_level);
      } catch {
        setError("Verification request failed");
      } finally {
        setVerifying(false);
      }
    },
    [agentId],
  );

  if (verified) {
    return (
      <div className="border border-green-500/30 bg-green-500/5 px-4 py-3 flex items-center gap-3">
        <span className="material-symbols-outlined text-green-400 text-xl">
          verified_user
        </span>
        <div>
          <p className="text-green-400 text-sm font-bold font-[family-name:var(--font-syne)] uppercase tracking-wider">
            Human Verified
          </p>
          <p className="text-green-400/60 text-xs">
            World ID {currentLevel === "orb" ? "Orb" : "Device"} verified
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-700/50 bg-slate-800/30 px-4 py-3">
      <p className="text-slate-400 text-xs mb-3">
        Verify you&apos;re human with World ID to enable AgentKit features and
        prove your agent is human-backed.
      </p>

      {error && (
        <p className="text-red-400 text-xs mb-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => startVerification("orb")}
          disabled={verifying}
          className="flex-1 border border-cyan-500/50 px-3 py-2 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-50"
        >
          {verifying && level === "orb" ? "VERIFYING..." : "ORB VERIFY"}
        </button>
        <button
          onClick={() => startVerification("device")}
          disabled={verifying}
          className="flex-1 border border-slate-600 px-3 py-2 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase text-slate-400 hover:bg-slate-700/50 transition-all disabled:opacity-50"
        >
          {verifying && level === "device" ? "VERIFYING..." : "DEVICE VERIFY"}
        </button>
      </div>

      {rpContext && appId && (
        <IDKitRequestWidget
          app_id={appId}
          action={action}
          rp_context={rpContext}
          preset={level === "orb" ? orbLegacy({}) : deviceLegacy({})}
          allow_legacy_proofs={true}
          open={open}
          onOpenChange={setOpen}
          handleVerify={handleVerify}
          onSuccess={() => {
            setOpen(false);
          }}
          onError={() => {
            setError("Verification was cancelled or failed");
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
