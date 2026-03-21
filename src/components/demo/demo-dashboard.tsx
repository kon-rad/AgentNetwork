"use client";

import { useState } from "react";

interface ActionResult {
  action: string;
  status: "success" | "failure";
  details: Record<string, unknown>;
}

interface RunResult {
  agentId: string;
  agentName: string;
  serviceType: string;
  actions: ActionResult[];
  logFilecoinCid: string | null;
}

const BASESCAN_TX_URL = "https://sepolia.basescan.org/tx/";

function StatusBadge({ status }: { status: "success" | "failure" }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[--color-neon-green]">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        success
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      failure
    </span>
  );
}

function DetailValue({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  const strVal = String(value);

  if (label === "txHash" && strVal.startsWith("0x")) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[--color-text-tertiary]">{label}:</span>
        <a
          href={`${BASESCAN_TX_URL}${strVal}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[--color-cyan] hover:underline truncate max-w-[240px]"
        >
          {strVal.slice(0, 10)}...{strVal.slice(-8)}
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[--color-text-tertiary]">{label}:</span>
      <span className="text-[--color-text-secondary] truncate max-w-[240px]">{strVal}</span>
    </div>
  );
}

function ActionCard({ action }: { action: ActionResult }) {
  const [expanded, setExpanded] = useState(false);
  const detailKeys = Object.keys(action.details).filter(
    (k) => action.details[k] !== null && action.details[k] !== undefined
  );

  return (
    <div className="border border-[--color-border] rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <StatusBadge status={action.status} />
          <span className="text-sm text-[--color-text-primary] font-medium">
            {action.action.replace(/_/g, " ")}
          </span>
        </div>
        {detailKeys.length > 0 && (
          <svg
            className={`w-4 h-4 text-[--color-text-tertiary] transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {expanded && detailKeys.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[--color-border] flex flex-col gap-1.5">
          {detailKeys.map((key) => (
            <DetailValue key={key} label={key} value={action.details[key]} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentResultCard({ result }: { result: RunResult }) {
  const successCount = result.actions.filter((a) => a.status === "success").length;
  const badgeClass = `badge-${result.serviceType}`;

  return (
    <div className="glass-card rounded-xl p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[--color-text-primary]">{result.agentName}</h3>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
            {result.serviceType}
          </span>
        </div>
        <div className="text-right text-xs text-[--color-text-secondary]">
          {successCount}/{result.actions.length} actions passed
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {result.actions.map((action, i) => (
          <ActionCard key={i} action={action} />
        ))}
      </div>

      {result.logFilecoinCid && (
        <div className="mt-3 pt-3 border-t border-[--color-border] text-xs text-[--color-text-tertiary]">
          Filecoin CID: <span className="text-[--color-text-secondary]">{result.logFilecoinCid}</span>
        </div>
      )}
    </div>
  );
}

export function DemoDashboard() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/autonomous/run", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      const data: RunResult[] = await res.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  // Summary stats
  const totalAgents = results?.length ?? 0;
  const totalActions = results?.reduce((sum, r) => sum + r.actions.length, 0) ?? 0;
  const totalSuccess = results?.reduce(
    (sum, r) => sum + r.actions.filter((a) => a.status === "success").length,
    0
  ) ?? 0;
  const successRate = totalActions > 0 ? Math.round((totalSuccess / totalActions) * 100) : 0;

  return (
    <div>
      {/* Run button */}
      <div className="flex justify-center mb-8">
        <button
          onClick={handleRun}
          disabled={running}
          className="px-8 py-3 rounded-xl text-sm font-semibold transition-all bg-[--color-cyan]/10 border border-[--color-cyan]/30 text-[--color-cyan] hover:bg-[--color-cyan]/20 hover:border-[--color-cyan]/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? "Running..." : "Run Autonomous Demo"}
        </button>
      </div>

      {/* Loading indicator */}
      {running && (
        <div className="glass-card rounded-xl p-6 mb-8 text-center animate-fade-in">
          <div className="inline-block w-3 h-3 rounded-full bg-[--color-cyan] mr-2" style={{ animation: "pulseGlow 1.5s ease-in-out infinite" }} />
          <span className="text-[--color-text-secondary]">
            Running autonomous loop... This may take several minutes.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card rounded-xl p-5 mb-8 border-red-500/20 animate-fade-in">
          <p className="text-red-400 text-sm font-medium">Error</p>
          <p className="text-red-300/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Summary stats */}
      {results && (
        <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-in">
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[--color-cyan]">{totalAgents}</div>
            <div className="text-xs text-[--color-text-secondary] mt-1">Agents Run</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[--color-cyan]">{totalActions}</div>
            <div className="text-xs text-[--color-text-secondary] mt-1">Total Actions</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[--color-neon-green]">{successRate}%</div>
            <div className="text-xs text-[--color-text-secondary] mt-1">Success Rate</div>
          </div>
        </div>
      )}

      {/* Agent results */}
      {results && (
        <div className="flex flex-col gap-4">
          {results.map((result, i) => (
            <div key={result.agentId} className={i < 8 ? `stagger-${i + 1}` : ""}>
              <AgentResultCard result={result} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
