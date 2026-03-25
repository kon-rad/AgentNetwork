"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { decodeEventLog } from "viem";

const BASESCAN_TOKEN_URL =
  "https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

const identityRegistryAbi = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

const registeredEventAbi = [
  {
    name: "Registered",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

type RegistrationStep = "idle" | "preparing" | "prompting" | "pending" | "confirming" | "done" | "error";

interface ERC8004StatusProps {
  agentId: string;
  tokenId: string | null;
  isOwner?: boolean;
}

export function ERC8004Status({ agentId, tokenId, isOwner }: ERC8004StatusProps) {
  const [currentTokenId, setCurrentTokenId] = useState<string | null>(tokenId);
  const [step, setStep] = useState<RegistrationStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retrievalUrl, setRetrievalUrl] = useState<string | null>(null);

  const { isConnected } = useAccount();

  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirmingTx, isSuccess: isTxConfirmed, data: receipt } =
    useWaitForTransactionReceipt({ hash: txHash });

  // When tx is confirmed, parse the event and call confirm API
  if (isTxConfirmed && receipt && step === "pending") {
    setStep("confirming");

    // Parse Registered event from receipt
    let parsedAgentId: string | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: registeredEventAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "Registered") {
          parsedAgentId = decoded.args.agentId.toString();
          break;
        }
      } catch {
        // Not a Registered event
      }
    }

    if (!parsedAgentId) {
      setError("Transaction succeeded but could not parse agent ID from receipt.");
      setStep("error");
    } else {
      // Confirm with backend
      fetch(`/api/agents/${agentId}/register/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: parsedAgentId,
          txHash: receipt.transactionHash,
          retrievalUrl,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to confirm registration");
          return res.json();
        })
        .then(() => {
          setCurrentTokenId(parsedAgentId!);
          setStep("done");
        })
        .catch((err) => {
          // The on-chain registration succeeded even if confirm fails
          setCurrentTokenId(parsedAgentId!);
          setStep("done");
          console.error("Confirm API error (on-chain registration succeeded):", err);
        });
    }
  }

  async function handleRegister() {
    setStep("preparing");
    setError(null);
    resetWrite();

    try {
      // Step 1: Prepare — upload agent card, get retrieval URL
      const prepRes = await fetch(`/api/agents/${agentId}/register/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!prepRes.ok) {
        const body = await prepRes.json().catch(() => ({}));
        throw new Error(body.details || body.error || "Preparation failed");
      }

      const { retrievalUrl: url } = await prepRes.json();
      setRetrievalUrl(url);

      // Step 2: Prompt wallet to sign register() tx
      setStep("prompting");
      writeContract(
        {
          address: IDENTITY_REGISTRY,
          abi: identityRegistryAbi,
          functionName: "register",
          args: [url],
        },
        {
          onSuccess: () => setStep("pending"),
          onError: (err) => {
            setError(err.message || "Transaction rejected");
            setStep("error");
          },
        },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      setStep("error");
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

  const stepLabel = {
    idle: "Register Identity",
    preparing: "Uploading agent card...",
    prompting: "Confirm in wallet...",
    pending: "Waiting for confirmation...",
    confirming: "Saving registration...",
    done: "Registered!",
    error: "Register Identity",
  }[step];

  const isDisabled = step !== "idle" && step !== "error";

  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-sm text-[#849495] mb-3">Not Registered</p>
      {isOwner ? (
        <>
          {!isConnected && (
            <p className="text-xs text-yellow-400 mb-3">
              Connect your wallet to register this agent on-chain.
            </p>
          )}
          <button
            onClick={handleRegister}
            disabled={isDisabled || !isConnected}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isDisabled
                ? "border-[#00f0ff]/20 text-[#00f0ff]/50 cursor-wait animate-pulse"
                : !isConnected
                  ? "border-[#849495]/20 text-[#849495]/50 cursor-not-allowed"
                  : "border-[#00f0ff]/20 text-[#00f0ff] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20"
            }`}
          >
            {stepLabel}
          </button>
          <p className="text-[10px] text-[#849495] mt-2">
            Your connected wallet will sign the transaction and become the on-chain owner of this agent&apos;s identity.
          </p>
          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-xs text-red-400 whitespace-pre-wrap">{error}</p>
              <button
                onClick={() => { setError(null); setStep("idle"); }}
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
