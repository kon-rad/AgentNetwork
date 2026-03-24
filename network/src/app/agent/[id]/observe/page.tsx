"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import type { AgentEvent } from "@/lib/types";

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  modified?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Event row rendering ───────────────────────────────────────────────────────

const EVENT_BADGE: Record<AgentEvent["event_type"], string> = {
  llm_call: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
  tool_call: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  turn_start: "bg-green-500/20 text-green-400 border border-green-500/30",
  turn_complete: "bg-green-500/20 text-green-400 border border-green-500/30",
  error: "bg-red-500/20 text-red-400 border border-red-500/30",
};

function eventSummary(event: AgentEvent): string {
  const p = event.payload;
  switch (event.event_type) {
    case "llm_call": {
      const model = (p.model as string) ?? "unknown";
      const input = (p.input_tokens as number) ?? 0;
      const output = (p.output_tokens as number) ?? 0;
      return `${model} — ${input} in / ${output} out tokens`;
    }
    case "tool_call": {
      const tool = (p.tool_name as string) ?? "unknown";
      const dur = p.duration_ms != null ? ` (${p.duration_ms as number}ms)` : "";
      return `${tool}${dur}`;
    }
    case "turn_start": {
      const preview = p.message_preview as string | undefined;
      return preview ? `Turn started — ${preview.slice(0, 80)}…` : "Turn started";
    }
    case "turn_complete": {
      const turns = (p.num_turns as number) ?? 0;
      const cost = p.total_cost_usd as number | undefined;
      const dur = p.duration_ms as number | undefined;
      const parts = [`${turns} turn${turns !== 1 ? "s" : ""}`];
      if (dur) parts.push(`${(dur / 1000).toFixed(1)}s`);
      if (cost) parts.push(`$${cost.toFixed(4)}`);
      return parts.join(" — ");
    }
    case "error": {
      const msg = (p.message as string) ?? "Unknown error";
      return `Error: ${msg}`;
    }
    default:
      return event.event_type;
  }
}

function EventDetailPanel({ event }: { event: AgentEvent }) {
  const p = event.payload;
  if (event.event_type === "llm_call") {
    return (
      <div className="mt-2 px-3 py-2 bg-black/40 border border-cyan-500/10 font-mono text-xs text-slate-300 space-y-1">
        <div>
          <span className="text-cyan-400/60">model: </span>
          {String(p.model ?? "—")}
        </div>
        <div>
          <span className="text-cyan-400/60">input_tokens: </span>
          {String(p.input_tokens ?? "—")}
        </div>
        <div>
          <span className="text-cyan-400/60">output_tokens: </span>
          {String(p.output_tokens ?? "—")}
        </div>
        {(p.cache_read_input_tokens as number) > 0 && (
          <div>
            <span className="text-cyan-400/60">cache_read: </span>
            {String(p.cache_read_input_tokens)}
          </div>
        )}
        {(p.cache_creation_input_tokens as number) > 0 && (
          <div>
            <span className="text-cyan-400/60">cache_creation: </span>
            {String(p.cache_creation_input_tokens)}
          </div>
        )}
        {typeof p.message_id === "string" && (
          <div>
            <span className="text-cyan-400/60">message_id: </span>
            <span className="text-slate-500">{p.message_id}</span>
          </div>
        )}
      </div>
    );
  }
  if (event.event_type === "tool_call") {
    return (
      <div className="mt-2 px-3 py-2 bg-black/40 border border-purple-500/10 font-mono text-xs text-slate-300 space-y-2">
        <div>
          <span className="text-purple-400/60">tool: </span>
          {String(p.tool_name ?? "—")}
        </div>
        {p.duration_ms != null && (
          <div>
            <span className="text-purple-400/60">duration: </span>
            {String(p.duration_ms)}ms
          </div>
        )}
        {p.input != null && (
          <div>
            <div className="text-purple-400/60 mb-0.5">input:</div>
            <pre className="overflow-auto max-h-40 text-[10px] text-slate-400 whitespace-pre-wrap">
              {JSON.stringify(p.input, null, 2)}
            </pre>
          </div>
        )}
        {p.output != null && (
          <div>
            <div className="text-purple-400/60 mb-0.5">output:</div>
            <pre className="overflow-auto max-h-40 text-[10px] text-slate-400 whitespace-pre-wrap">
              {JSON.stringify(p.output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }
  if (event.event_type === "turn_complete") {
    const modelUsage = p.model_usage as Record<string, Record<string, unknown>> | undefined;
    return (
      <div className="mt-2 px-3 py-2 bg-black/40 border border-green-500/10 font-mono text-xs text-slate-300 space-y-1">
        <div>
          <span className="text-green-400/60">num_turns: </span>
          {String(p.num_turns ?? "—")}
        </div>
        <div>
          <span className="text-green-400/60">duration: </span>
          {String(p.duration_ms ?? "—")}ms
        </div>
        <div>
          <span className="text-green-400/60">api_duration: </span>
          {String(p.duration_api_ms ?? "—")}ms
        </div>
        <div>
          <span className="text-green-400/60">total_cost: </span>
          ${String(((p.total_cost_usd as number) ?? 0).toFixed(4))}
        </div>
        <div>
          <span className="text-green-400/60">input_tokens: </span>
          {String(p.input_tokens ?? "—")}
        </div>
        <div>
          <span className="text-green-400/60">output_tokens: </span>
          {String(p.output_tokens ?? "—")}
        </div>
        {modelUsage && Object.keys(modelUsage).length > 0 && (
          <div>
            <div className="text-green-400/60 mb-0.5">model_usage:</div>
            <pre className="overflow-auto max-h-40 text-[10px] text-slate-400 whitespace-pre-wrap">
              {JSON.stringify(modelUsage, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }
  if (event.event_type === "turn_start" && p.message_preview) {
    return (
      <div className="mt-2 px-3 py-2 bg-black/40 border border-green-500/10 font-mono text-xs text-slate-300">
        <span className="text-green-400/60">prompt: </span>
        <span className="text-slate-400">{String(p.message_preview)}</span>
      </div>
    );
  }
  return null;
}

// ─── File tree ─────────────────────────────────────────────────────────────────

function FileTree({ files }: { files: FileEntry[] }) {
  if (files.length === 0) {
    return (
      <p className="text-center font-mono text-xs text-slate-500 py-8 uppercase tracking-widest">
        No workspace files yet — agent hasn&apos;t run a task.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {files.map((f) => (
        <li key={f.path} className="font-mono text-xs flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors">
          {f.type === "dir" ? (
            <>
              <span className="text-yellow-400/70">&#128193;</span>
              <span className="font-bold text-slate-200">{f.name}</span>
            </>
          ) : (
            <>
              <span className="text-slate-500">&#128196;</span>
              <span className="text-slate-300">{f.name}</span>
              {f.size != null && (
                <span className="text-slate-600 ml-auto">{formatBytes(f.size)}</span>
              )}
              {f.modified && (
                <span className="text-slate-700 ml-2 hidden sm:inline">
                  {new Date(f.modified).toLocaleDateString()}
                </span>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ObservePage() {
  const { id } = useParams<{ id: string }>();

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"events" | "files">("events");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesFetched, setFilesFetched] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Token usage memo
  const tokenTotals = useMemo(() => {
    const llmEvents = events.filter((e) => e.event_type === "llm_call");
    return llmEvents.reduce(
      (acc, e) => ({
        input: acc.input + ((e.payload.input_tokens as number) ?? 0),
        output: acc.output + ((e.payload.output_tokens as number) ?? 0),
      }),
      { input: 0, output: 0 }
    );
  }, [events]);

  // Load agent name
  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.display_name) setAgentName(data.display_name as string);
      })
      .catch(() => {});
  }, [id]);

  // Ownership check + load recent events
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Ownership check — reuse chat route (requireOwnership already guards it)
      const authRes = await fetch(`/api/agents/${id}/chat`);
      if (authRes.status === 401 || authRes.status === 403) {
        if (!cancelled) {
          setAccessDenied(true);
          setLoading(false);
        }
        return;
      }

      // Load recent events
      const supabase = createClient();
      const { data } = await supabase
        .from("agent_events")
        .select("*")
        .eq("agent_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled && data) {
        setEvents(data as AgentEvent[]);
      }
      if (!cancelled) setLoading(false);

      // Realtime subscription
      const channel = supabase
        .channel(`agent-events-${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "agent_events",
            filter: `agent_id=eq.${id}`,
          },
          (payload) => {
            setEvents((prev) => [payload.new as AgentEvent, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanupPromise = init();

    return () => {
      cancelled = true;
      // Clean up channel if init resolved
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [id]);

  // Lazy load files when tab opened
  useEffect(() => {
    if (activeTab !== "files" || filesFetched) return;
    setFilesLoading(true);
    fetch(`/api/agents/${id}/files`)
      .then((r) => r.json())
      .then((data: { files: FileEntry[] }) => {
        setFiles(data.files ?? []);
        setFilesFetched(true);
        setFilesLoading(false);
      })
      .catch(() => {
        setFilesFetched(true);
        setFilesLoading(false);
      });
  }, [activeTab, id, filesFetched]);

  function toggleExpand(eventId: string) {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  // ── Access denied ──
  if (accessDenied) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="glass-card p-6 text-center">
          <p className="font-mono text-red-400 text-sm uppercase tracking-widest">
            Access denied — this dashboard is only visible to the agent&apos;s owner.
          </p>
          <Link
            href={`/agent/${id}`}
            className="mt-4 inline-block font-mono text-xs text-cyan-400 hover:underline"
          >
            &larr; Back to agent profile
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="glass-card p-6 animate-pulse">
          <div className="h-4 bg-cyan-500/10 rounded mb-3 w-1/3" />
          <div className="h-4 bg-cyan-500/10 rounded mb-2 w-full" />
          <div className="h-4 bg-cyan-500/10 rounded w-2/3" />
        </div>
      </div>
    );
  }

  const isExpandable = (e: AgentEvent) =>
    e.event_type === "tool_call" ||
    e.event_type === "llm_call" ||
    e.event_type === "turn_complete" ||
    (e.event_type === "turn_start" && !!e.payload.message_preview);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/agent/${id}`}
            className="font-mono text-xs text-slate-400 hover:text-cyan-400 transition-colors uppercase tracking-widest"
          >
            &larr; Profile
          </Link>
          <span className="text-slate-600">|</span>
          <h1 className="font-[family-name:var(--font-syne)] text-lg font-bold text-cyan-400 uppercase tracking-wide">
            {agentName ? `${agentName} — Observe` : "Observe"}
          </h1>
        </div>
        <span className="font-mono text-[10px] text-cyan-400/50 uppercase tracking-widest">
          live
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 ml-1.5 animate-pulse" />
        </span>
      </div>

      {/* Token usage summary */}
      <div className="glass-card px-4 py-3 flex flex-wrap gap-4 font-mono text-xs">
        <span className="text-slate-500 uppercase tracking-widest">Token usage</span>
        <span>
          <span className="text-slate-500">Total: </span>
          <span className="text-cyan-400 font-bold">{tokenTotals.input + tokenTotals.output}</span>
        </span>
        <span>
          <span className="text-slate-500">Input: </span>
          <span className="text-cyan-300">{tokenTotals.input}</span>
        </span>
        <span>
          <span className="text-slate-500">Output: </span>
          <span className="text-cyan-300">{tokenTotals.output}</span>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(["events", "files"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 font-mono text-xs uppercase tracking-widest transition-colors border ${
              activeTab === tab
                ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400"
                : "bg-transparent border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Events tab */}
      {activeTab === "events" && (
        <div className="glass-card divide-y divide-white/5">
          {events.length === 0 && (
            <div className="py-12 text-center font-mono text-xs text-slate-500 uppercase tracking-widest">
              // No events yet — run a chat turn to see agent activity
            </div>
          )}
          {events.map((event) => {
            const expanded = expandedEvents.has(event.id);
            const expandable = isExpandable(event);
            return (
              <div key={event.id} className="px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Badge */}
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 uppercase tracking-widest ${EVENT_BADGE[event.event_type] ?? "bg-slate-500/20 text-slate-400"}`}
                  >
                    {event.event_type}
                  </span>

                  {/* Summary */}
                  <span className="font-mono text-xs text-slate-300 flex-1 min-w-0 truncate">
                    {eventSummary(event)}
                  </span>

                  {/* Timestamp */}
                  <span className="font-mono text-[10px] text-slate-600 shrink-0">
                    {formatRelTime(event.created_at)}
                  </span>

                  {/* Expand toggle */}
                  {expandable && (
                    <button
                      onClick={() => toggleExpand(event.id)}
                      className="font-mono text-[10px] text-slate-500 hover:text-cyan-400 transition-colors shrink-0"
                      aria-label={expanded ? "Collapse" : "Expand"}
                    >
                      {expanded ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {/* Detail panel */}
                {expanded && expandable && <EventDetailPanel event={event} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Files tab */}
      {activeTab === "files" && (
        <div className="glass-card p-4">
          {filesLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-cyan-500/10 rounded w-1/2" />
              <div className="h-3 bg-cyan-500/10 rounded w-3/4" />
              <div className="h-3 bg-cyan-500/10 rounded w-2/5" />
            </div>
          ) : (
            <FileTree files={files} />
          )}
        </div>
      )}
    </div>
  );
}
