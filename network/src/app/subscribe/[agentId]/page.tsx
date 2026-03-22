"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import type { Agent } from "@/lib/types";

const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const REQUIRED_AMOUNT = parseUnits("100", 6); // 100_000_000n

type PaymentState =
  | "idle"
  | "prompting"
  | "pending"
  | "confirming"
  | "launching"
  | "error";

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-cyan-400 inline-block"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function SubscribePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { isConnected } = useAccount();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    isError: isWriteError,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Load agent data and existing subscription on mount
  useEffect(() => {
    if (!agentId) return;

    fetch(`/api/agents/${agentId}`)
      .then((r) => r.json())
      .then((data: Agent) => setAgent(data))
      .catch(() => {});

    fetch(`/api/subscriptions/${agentId}`)
      .then((r) => r.json())
      .then((data: { has_active: boolean; expires_at?: string }) => {
        if (data.has_active) {
          setHasActiveSubscription(true);
          if (data.expires_at) {
            setExpiryDate(
              new Date(data.expires_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            );
          }
        }
      })
      .catch(() => {});
  }, [agentId]);

  // Drive state machine from wagmi hooks
  useEffect(() => {
    if (isWriteError && writeError) {
      setPaymentState("error");
      setErrorMessage(writeError.message || "Transaction failed");
    }
  }, [isWriteError, writeError]);

  useEffect(() => {
    if (txHash && paymentState === "prompting") {
      setPaymentState("pending");
    }
  }, [txHash, paymentState]);

  useEffect(() => {
    if (isConfirmed && txHash && paymentState === "pending") {
      setPaymentState("confirming");

      fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_hash: txHash, agent_id: agentId }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
          }
          setPaymentState("launching");
        })
        .catch((err: unknown) => {
          setPaymentState("error");
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to record subscription"
          );
        });
    }
  }, [isConfirmed, txHash, paymentState, agentId]);

  function handleSubscribe() {
    const treasury = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as
      | `0x${string}`
      | undefined;
    if (!treasury) {
      setPaymentState("error");
      setErrorMessage("Treasury address not configured");
      return;
    }
    setPaymentState("prompting");
    setErrorMessage(null);
    writeContract({
      address: USDC_CONTRACT,
      abi: erc20Abi,
      functionName: "transfer",
      args: [treasury, REQUIRED_AMOUNT],
    });
  }

  function handleReset() {
    setPaymentState("idle");
    setErrorMessage(null);
  }

  const agentName = agent?.display_name ?? "Loading...";

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <div className="relative bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 p-8">
        <div className="hud-bracket-tl" />
        <div className="hud-bracket-tr" />
        <div className="hud-bracket-bl" />
        <div className="hud-bracket-br" />

        <div className="mb-6">
          <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-1">
            // Subscribe to
          </p>
          <h1 className="font-[family-name:var(--font-syne)] text-3xl font-extrabold tracking-tighter text-cyan-400 italic">
            {agentName}
          </h1>
        </div>

        {/* Price display */}
        <div className="flex items-baseline gap-2 mb-8">
          <span className="font-mono text-4xl font-bold text-[#00f0ff]">
            100
          </span>
          <span className="font-mono text-lg text-slate-400">USDC</span>
          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">
            / month
          </span>
        </div>

        {/* Active subscription badge */}
        {hasActiveSubscription && expiryDate && paymentState === "idle" && (
          <div className="mb-6 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 font-mono text-xs text-cyan-400 uppercase tracking-wider">
            Active subscription — expires {expiryDate}
          </div>
        )}

        {/* State machine UI */}
        {paymentState === "idle" && (
          <div className="space-y-3">
            {!isConnected ? (
              <div className="py-4 text-center font-mono text-sm text-slate-400 border border-slate-700/50 bg-slate-800/40">
                Connect wallet to subscribe
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={isWritePending}
                className="w-full py-4 bg-[#00f0ff] text-[#006970] font-[family-name:var(--font-syne)] font-black text-xl uppercase tracking-widest shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.6)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {hasActiveSubscription ? "Renew Subscription" : "Subscribe"}
              </button>
            )}
          </div>
        )}

        {paymentState === "prompting" && (
          <div className="flex items-center gap-3 py-4 font-mono text-sm text-cyan-400">
            <Spinner />
            <span>Waiting for wallet approval...</span>
          </div>
        )}

        {paymentState === "pending" && txHash && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 font-mono text-sm text-cyan-400">
              <Spinner />
              <span>Transaction pending</span>
            </div>
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-mono text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors truncate border border-cyan-500/20 px-3 py-2 bg-cyan-500/5"
            >
              {txHash.slice(0, 20)}...{txHash.slice(-8)} &rarr; BaseScan
            </a>
          </div>
        )}

        {(paymentState === "confirming" || isConfirming) &&
          paymentState !== "launching" && (
            <div className="flex items-center gap-3 py-4 font-mono text-sm text-cyan-400">
              <Spinner />
              <span>Confirming on-chain...</span>
            </div>
          )}

        {paymentState === "launching" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 font-mono text-sm text-[#00e479]">
              <svg
                className="h-6 w-6 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-black uppercase tracking-widest">
                Agent Launching!
              </span>
            </div>
            <Link
              href={`/agent/${agentId}`}
              className="block w-full py-3 text-center font-mono text-sm text-cyan-400 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all uppercase tracking-widest"
            >
              Go to Agent Profile &rarr;
            </Link>
          </div>
        )}

        {paymentState === "error" && (
          <div className="space-y-3">
            <p className="font-mono text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-4 py-3">
              {errorMessage || "An error occurred. Please try again."}
            </p>
            <button
              onClick={handleReset}
              className="w-full py-3 font-mono text-sm text-cyan-400 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all uppercase tracking-widest"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
