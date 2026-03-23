"use client";

import { useState } from "react";

interface TokenLaunchProps {
  agentId: string;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  displayName: string;
}

export function TokenLaunch({
  agentId,
  tokenSymbol,
  tokenAddress,
  displayName,
}: TokenLaunchProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<{
    tokenAddress?: string;
    txHash?: string;
    uniswapUrl?: string;
    baseScanUrl?: string;
    error?: string;
  } | null>(null);

  // Already deployed
  if (tokenAddress) {
    return null;
  }

  // No symbol configured
  if (!tokenSymbol) {
    return (
      <div className="w-full mt-4 p-4 border border-slate-700/40 bg-slate-900/50">
        <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">
          No token symbol configured. Set a token symbol to enable launch.
        </p>
      </div>
    );
  }

  async function handleLaunch() {
    if (!privateKey.startsWith("0x") || privateKey.length < 66) {
      setResult({ error: "Invalid private key format. Must be a 0x-prefixed hex string." });
      return;
    }

    setLaunching(true);
    setResult(null);

    try {
      const res = await fetch("/api/chain/deploy-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, private_key: privateKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error || "Deployment failed" });
      } else {
        setResult({
          tokenAddress: data.tokenAddress,
          txHash: data.txHash,
          uniswapUrl: data.uniswapUrl,
          baseScanUrl: data.baseScanUrl,
        });
        setPrivateKey("");
      }
    } catch {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="w-full mt-4">
      {/* Launch header */}
      <div className="border border-[#f6be37]/30 bg-[#f6be37]/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-mono text-xs text-[#f6be37] uppercase tracking-widest">
            Launch ${tokenSymbol} Token
          </h4>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-1 font-mono text-[10px] text-slate-400 hover:text-cyan-400 uppercase tracking-wider transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            {showInfo ? "Hide" : "Info"}
          </button>
        </div>

        {/* Info panel */}
        {showInfo && (
          <div className="mb-4 p-3 bg-slate-900/60 border border-slate-700/40 space-y-3">
            <h5 className="font-mono text-xs text-cyan-400 uppercase tracking-wider">
              How Clanker Token Launch Works
            </h5>
            <p className="text-xs text-slate-400 leading-relaxed">
              Clanker deploys an ERC-20 token on <span className="text-slate-300">Base chain</span> with
              an instantly tradeable <span className="text-slate-300">Uniswap V4</span> liquidity pool.
              Liquidity is locked permanently &mdash; no rug pulls possible.
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Total Supply</span>
                <span className="text-slate-300 font-mono">1,000,000,000</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Pool Pairing</span>
                <span className="text-slate-300 font-mono">WETH (Base)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Agent Vault</span>
                <span className="text-slate-300 font-mono">20% of supply</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Vault Lockup</span>
                <span className="text-slate-300 font-mono">7 days</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">LP Fee Rewards</span>
                <span className="text-slate-300 font-mono">100% to agent</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Pool Type</span>
                <span className="text-slate-300 font-mono">Standard (meme curve)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Liquidity</span>
                <span className="text-[#00e479] font-mono">Locked permanently</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              The agent&apos;s wallet signs the deployment transaction and becomes the token admin.
              20% of supply is vaulted for the agent with a 7-day lockup. All LP trading fees
              flow to the agent wallet.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="https://clanker.gitbook.io/clanker-documentation"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 uppercase tracking-wider underline underline-offset-2"
              >
                Clanker Docs &rarr;
              </a>
              <a
                href="https://clanker.gitbook.io/clanker-documentation/sdk/v4.0.0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 uppercase tracking-wider underline underline-offset-2"
              >
                SDK Reference &rarr;
              </a>
              <a
                href="https://clanker.world/about"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 uppercase tracking-wider underline underline-offset-2"
              >
                About Clanker &rarr;
              </a>
            </div>
          </div>
        )}

        {/* Launch parameters summary */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-slate-900/40 p-2">
            <div className="font-mono text-[10px] text-slate-500 uppercase">Token Name</div>
            <div className="font-mono text-xs text-slate-300 truncate">{displayName} Token</div>
          </div>
          <div className="bg-slate-900/40 p-2">
            <div className="font-mono text-[10px] text-slate-500 uppercase">Symbol</div>
            <div className="font-mono text-xs text-[#f6be37]">${tokenSymbol}</div>
          </div>
          <div className="bg-slate-900/40 p-2">
            <div className="font-mono text-[10px] text-slate-500 uppercase">Chain</div>
            <div className="font-mono text-xs text-slate-300">Base (8453)</div>
          </div>
          <div className="bg-slate-900/40 p-2">
            <div className="font-mono text-[10px] text-slate-500 uppercase">Vault</div>
            <div className="font-mono text-xs text-slate-300">20% / 7d lock</div>
          </div>
        </div>

        {/* Private key input */}
        <div className="mb-3">
          <label className="block font-mono text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Agent Private Key
          </label>
          <input
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="0x..."
            className="w-full bg-slate-900/60 border border-slate-700/40 text-xs font-mono text-slate-300 px-3 py-2 focus:outline-none focus:border-[#f6be37]/50 placeholder:text-slate-600"
            disabled={launching}
          />
          <p className="font-mono text-[10px] text-slate-600 mt-1">
            The agent&apos;s private key is used to sign the deployment tx. It is not stored.
          </p>
        </div>

        {/* Result messages */}
        {result?.error && (
          <div className="mb-3 p-2 bg-red-900/20 border border-red-500/30 text-red-400 font-mono text-xs">
            {result.error}
          </div>
        )}

        {result?.tokenAddress && (
          <div className="mb-3 p-3 bg-[#00e479]/10 border border-[#00e479]/30 space-y-2">
            <div className="font-mono text-xs text-[#00e479] uppercase tracking-wider">
              Token Deployed Successfully
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              Contract: <span className="text-slate-300">{result.tokenAddress}</span>
            </div>
            {result.txHash && (
              <div className="font-mono text-[10px] text-slate-400">
                Tx: <span className="text-slate-300">{result.txHash.slice(0, 14)}...{result.txHash.slice(-8)}</span>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              {result.uniswapUrl && (
                <a
                  href={result.uniswapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-cyan-400 hover:text-cyan-300 uppercase underline underline-offset-2"
                >
                  Trade on Uniswap &rarr;
                </a>
              )}
              {result.baseScanUrl && (
                <a
                  href={result.baseScanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-cyan-400 hover:text-cyan-300 uppercase underline underline-offset-2"
                >
                  View on BaseScan &rarr;
                </a>
              )}
            </div>
          </div>
        )}

        {/* Launch button */}
        {!result?.tokenAddress && (
          <button
            onClick={handleLaunch}
            disabled={launching || !privateKey}
            className="w-full py-3 bg-[#f6be37] text-[#1a1400] font-[family-name:var(--font-syne)] font-black text-sm uppercase tracking-widest hover:shadow-[0_0_25px_rgba(246,190,55,0.4)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {launching ? "DEPLOYING TOKEN..." : `LAUNCH $${tokenSymbol} ON BASE`}
          </button>
        )}
      </div>
    </div>
  );
}
