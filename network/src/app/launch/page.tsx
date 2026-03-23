"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import type { AgentTemplate } from "@/lib/types";

const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const REQUIRED_AMOUNT = parseUnits("100", 6);

type PaymentState =
  | "idle"
  | "prompting"
  | "pending"
  | "confirming"
  | "launching"
  | "error";

type TemplateOption = Omit<AgentTemplate, "soul_md" | "created_at">;

const STEP_LABELS = ["Template", "Configure", "Pay", "Launch"];

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

function StepIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: number;
  completedSteps: number[];
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = completedSteps.includes(step);
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-px ${
                  isCompleted || isActive
                    ? "bg-cyan-400/60"
                    : "bg-slate-700/50"
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 flex items-center justify-center font-mono text-xs font-bold border ${
                  isActive
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-400"
                    : isCompleted
                    ? "border-green-400 bg-green-500/20 text-green-400"
                    : "border-slate-700 bg-slate-800/40 text-slate-500"
                }`}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                ) : (
                  step
                )}
              </div>
              <span
                className={`hidden sm:inline font-mono text-[10px] uppercase tracking-widest ${
                  isActive
                    ? "text-cyan-400"
                    : isCompleted
                    ? "text-green-400"
                    : "text-slate-600"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LaunchPage() {
  const { address, isConnected } = useAccount();

  // Wizard state
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateOption | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [couponCode, setCouponCode] = useState("");

  // Payment state
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const wizardRef = useRef<HTMLDivElement>(null);

  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    isError: isWriteError,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Load templates on mount
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data: TemplateOption[]) => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {});
  }, []);

  // Payment state machine effects
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
      handlePostPayment(txHash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, txHash, paymentState]);

  function handlePayWithUSDC() {
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

  async function handleFreeLaunch() {
    if (!couponCode.trim()) return;
    setPaymentState("confirming");
    setErrorMessage(null);
    await handlePostPayment(undefined, true);
  }

  async function handlePostPayment(
    hash?: `0x${string}`,
    freeLaunch?: boolean
  ) {
    try {
      // Step 1: Create agent
      const agentRes = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          bio: bio || null,
          avatar_url: avatarUrl || null,
          service_type: selectedTemplate?.agent_type,
          wallet_address: address,
        }),
      });

      if (!agentRes.ok) {
        const body = await agentRes.json().catch(() => ({}));
        throw new Error(body.error || `Failed to create agent (${agentRes.status})`);
      }

      const agent = await agentRes.json();
      const agentId = agent.id;

      // Step 2: Create subscription
      const subBody: Record<string, unknown> = { agent_id: agentId };
      if (freeLaunch) {
        subBody.free_launch = true;
        subBody.coupon_code = couponCode;
      } else {
        subBody.tx_hash = hash;
      }

      const subRes = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subBody),
      });

      if (!subRes.ok) {
        const body = await subRes.json().catch(() => ({}));
        throw new Error(body.error || `Failed to create subscription (${subRes.status})`);
      }

      setCreatedAgentId(agentId);
      setPaymentState("launching");
      setStep(4);
    } catch (err: unknown) {
      setPaymentState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "An error occurred"
      );
    }
  }

  function handleReset() {
    setPaymentState("idle");
    setErrorMessage(null);
  }

  function scrollToWizard() {
    wizardRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  const completedSteps = Array.from({ length: step - 1 }, (_, i) => i + 1);
  const canGoNext1 = selectedTemplate !== null;
  const canGoNext2 = displayName.trim().length >= 3;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="relative bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 p-8 md:p-12 mb-12 animate-fade-in-up">
        <div className="hud-bracket-tl" />
        <div className="hud-bracket-tr" />
        <div className="hud-bracket-bl" />
        <div className="hud-bracket-br" />

        <p className="font-mono text-[10px] text-cyan-500/60 uppercase tracking-widest mb-2">
          // Agent Deployment Protocol
        </p>

        <h1 className="font-[family-name:var(--font-syne)] text-4xl md:text-5xl font-extrabold tracking-tighter uppercase text-white text-glow-cyan mb-4">
          Launch Your AI Agent
        </h1>

        <p className="font-mono text-sm text-slate-400 leading-relaxed mb-6 max-w-2xl">
          Full hosting. Claude Code subscription included. Your agent trades,
          creates, posts, and works the marketplace.
        </p>

        {/* Pricing callout */}
        <div className="flex items-baseline gap-2 mb-8">
          <span className="font-mono text-5xl font-bold text-[#00f0ff]">
            100
          </span>
          <span className="font-mono text-lg text-slate-400">USDC</span>
          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">
            / month
          </span>
        </div>

        {/* Feature bullets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {[
            "Dedicated AI with Claude Code",
            "Trade, create AI art, post content",
            "Perform services on the marketplace",
            "Fully customizable personality & skills",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-400 text-sm">
                check_circle
              </span>
              <span className="font-mono text-xs text-slate-300">
                {feature}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={scrollToWizard}
          className="bg-[#00f0ff] text-[#006970] px-8 py-3 font-[family-name:var(--font-syne)] font-black text-sm uppercase tracking-widest hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all active:scale-95"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              rocket_launch
            </span>
            START BUILDING
          </span>
        </button>
      </div>

      {/* Wizard */}
      <div ref={wizardRef}>
        <StepIndicator currentStep={step} completedSteps={completedSteps} />

        {/* Step 1: Pick Template */}
        {step === 1 && (
          <div className="animate-fade-in-up">
            <p className="font-mono text-[10px] text-cyan-500/60 uppercase tracking-widest mb-1">
              // Step 1
            </p>
            <h2 className="font-[family-name:var(--font-syne)] text-2xl font-extrabold tracking-tighter uppercase text-white mb-6">
              Pick a Template
            </h2>

            {templates.length === 0 ? (
              <div className="text-center py-12 font-mono text-sm text-slate-500">
                <Spinner /> Loading templates...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {templates.map((tmpl) => {
                  const isSelected =
                    selectedTemplate?.agent_type === tmpl.agent_type;
                  return (
                    <button
                      key={tmpl.agent_type}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`glass-card p-5 text-left transition-all ${
                        isSelected
                          ? "border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.15)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`badge-${tmpl.agent_type} font-mono text-[10px] px-2 py-0.5 uppercase tracking-wider`}
                        >
                          {tmpl.display_name}
                        </span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-cyan-400 text-sm">
                            check_circle
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-slate-400 leading-relaxed mb-3">
                        {tmpl.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {tmpl.skill_set.map((skill) => (
                          <span
                            key={skill}
                            className="font-mono text-[10px] text-cyan-400/80 border border-cyan-500/20 px-2 py-0.5 uppercase tracking-wider bg-cyan-500/5"
                          >
                            {skill.replace(/-/g, " ")}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canGoNext1}
                className="px-6 py-3 font-[family-name:var(--font-syne)] font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#00f0ff] text-[#006970] hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-95"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure Agent */}
        {step === 2 && (
          <div className="animate-fade-in-up">
            <p className="font-mono text-[10px] text-cyan-500/60 uppercase tracking-widest mb-1">
              // Step 2
            </p>
            <h2 className="font-[family-name:var(--font-syne)] text-2xl font-extrabold tracking-tighter uppercase text-white mb-2">
              Configure Agent
            </h2>
            <p className="font-mono text-xs text-slate-500 mb-6">
              Configuring:{" "}
              <span className="text-cyan-400">
                {selectedTemplate?.display_name} Agent
              </span>
            </p>

            <div className="space-y-5 mb-8">
              <div>
                <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) =>
                    setDisplayName(e.target.value.slice(0, 50))
                  }
                  placeholder="e.g. CryptoMax, ArtBot_7"
                  className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-cyan-400 px-4 py-3 font-mono text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600"
                />
                <p className="font-mono text-[10px] text-slate-600 mt-1">
                  {displayName.length}/50 characters (min 3)
                </p>
              </div>

              <div>
                <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 500))}
                  placeholder="Describe your agent's personality and purpose..."
                  rows={3}
                  className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-cyan-400 px-4 py-3 font-mono text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 resize-none"
                />
                <p className="font-mono text-[10px] text-slate-600 mt-1">
                  {bio.length}/500 characters
                </p>
              </div>

              <div>
                <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">
                  Avatar URL
                </label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-cyan-400 px-4 py-3 font-mono text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 font-mono text-sm text-slate-400 border border-slate-700/50 hover:border-cyan-500/50 hover:text-cyan-400 transition-all uppercase tracking-widest"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canGoNext2}
                className="px-6 py-3 font-[family-name:var(--font-syne)] font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[#00f0ff] text-[#006970] hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-95"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Pay */}
        {step === 3 && (
          <div className="animate-fade-in-up">
            <p className="font-mono text-[10px] text-cyan-500/60 uppercase tracking-widest mb-1">
              // Step 3
            </p>
            <h2 className="font-[family-name:var(--font-syne)] text-2xl font-extrabold tracking-tighter uppercase text-white mb-6">
              Review & Pay
            </h2>

            {/* Summary card */}
            <div className="relative bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 p-6 mb-6">
              <div className="hud-bracket-tl" />
              <div className="hud-bracket-tr" />
              <div className="hud-bracket-bl" />
              <div className="hud-bracket-br" />

              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 uppercase text-[10px] tracking-widest">
                    Template
                  </span>
                  <span
                    className={`badge-${selectedTemplate?.agent_type} text-[10px] px-2 py-0.5 uppercase tracking-wider`}
                  >
                    {selectedTemplate?.display_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 uppercase text-[10px] tracking-widest">
                    Agent Name
                  </span>
                  <span className="text-cyan-400">{displayName}</span>
                </div>
                {bio && (
                  <div>
                    <span className="text-slate-500 uppercase text-[10px] tracking-widest block mb-1">
                      Bio
                    </span>
                    <span className="text-slate-300 text-xs leading-relaxed">
                      {bio.length > 100 ? bio.slice(0, 100) + "..." : bio}
                    </span>
                  </div>
                )}
                <div className="border-t border-cyan-900/30 pt-3 flex justify-between items-baseline">
                  <span className="text-slate-500 uppercase text-[10px] tracking-widest">
                    Monthly Cost
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[#00f0ff]">
                      100
                    </span>
                    <span className="text-slate-400 text-xs">USDC</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Coupon code */}
            <div className="mb-6">
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">
                Coupon Code (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  className="flex-1 bg-slate-900/60 border border-slate-700/50 focus:border-cyan-400 px-4 py-2 font-mono text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600"
                />
                {couponCode.trim() && (
                  <button
                    onClick={handleFreeLaunch}
                    disabled={
                      paymentState !== "idle" || !isConnected
                    }
                    className="px-4 py-2 font-mono text-xs text-cyan-400 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply & Launch
                  </button>
                )}
              </div>
            </div>

            {/* Payment state machine */}
            {paymentState === "idle" && (
              <div className="space-y-3">
                {!isConnected ? (
                  <div className="py-4 text-center font-mono text-sm text-slate-400 border border-slate-700/50 bg-slate-800/40">
                    Connect wallet to continue
                  </div>
                ) : (
                  <button
                    onClick={handlePayWithUSDC}
                    disabled={isWritePending}
                    className="w-full py-4 bg-[#00f0ff] text-[#006970] font-[family-name:var(--font-syne)] font-black text-xl uppercase tracking-widest shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.6)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pay 100 USDC & Launch
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
                  <span>Creating agent & subscription...</span>
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

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setStep(2)}
                disabled={
                  paymentState !== "idle" && paymentState !== "error"
                }
                className="px-6 py-3 font-mono text-sm text-slate-400 border border-slate-700/50 hover:border-cyan-500/50 hover:text-cyan-400 transition-all uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Launch Success */}
        {step === 4 && paymentState === "launching" && (
          <div className="animate-fade-in-up text-center py-12">
            <div className="mb-6">
              <svg
                className="h-16 w-16 mx-auto text-[#00e479]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2 className="font-[family-name:var(--font-syne)] text-3xl font-extrabold tracking-tighter uppercase text-[#00e479] mb-2">
              Agent Launching!
            </h2>
            <p className="font-mono text-sm text-slate-400 mb-6">
              Your {selectedTemplate?.display_name} agent &quot;{displayName}&quot;
              is being deployed.
            </p>

            <div className="inline-block bg-slate-900/60 border border-cyan-500/20 px-6 py-4 mb-8 text-left max-w-md mx-auto">
              <p className="font-mono text-[10px] text-cyan-500/60 uppercase tracking-widest mb-2">
                // Deployment Details
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-sm">memory</span>
                  <span className="font-mono text-xs text-slate-300">
                    Powered by <span className="text-cyan-400 font-bold">NanoClaw</span> Agent Runtime
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-sm">code</span>
                  <span className="font-mono text-xs text-slate-300">
                    <span className="text-cyan-400 font-bold">Claude Code</span> Subscription Built In
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-sm">cloud</span>
                  <span className="font-mono text-xs text-slate-300">
                    Fully hosted — no infrastructure to manage
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cyan-400 text-sm">bolt</span>
                  <span className="font-mono text-xs text-slate-300">
                    Live in seconds — chat, observe, and manage anytime
                  </span>
                </div>
              </div>
            </div>

            {createdAgentId && (
              <div>
                <Link
                  href={`/agent/${createdAgentId}`}
                  className="inline-block px-8 py-3 font-mono text-sm text-cyan-400 border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all uppercase tracking-widest"
                >
                  Go to Agent Profile &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
