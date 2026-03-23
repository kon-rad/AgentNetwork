"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ChatMessage, AgentStatus } from "@/lib/types";

export default function AgentChatPage() {
  const { id } = useParams<{ id: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [streamingContent, setStreamingContent] = useState("");
  const [agentName, setAgentName] = useState<string>("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const streamingContentRef = useRef<string>("");

  // Keep ref in sync with state for SSE handler closure
  useEffect(() => {
    streamingContentRef.current = streamingContent;
  }, [streamingContent]);

  // Load agent name
  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.display_name) setAgentName(data.display_name);
      })
      .catch(() => {});
  }, [id]);

  // Load history + open SSE
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const res = await fetch(`/api/agents/${id}/chat`);
      if (res.status === 401 || res.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        if (!cancelled) {
          setMessages(data);
          setLoading(false);
        }
      } else {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();

    function openEventSource() {
      const es = new EventSource(`/api/agents/${id}/chat/stream`);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as {
            type: string;
            content?: string;
          };

          if (parsed.type === "thinking") {
            setStatus("thinking");
          } else if (parsed.type === "tool_use") {
            setStatus("using tool");
          } else if (parsed.type === "response") {
            setStatus("idle");
            setStreamingContent(parsed.content ?? "");
          } else if (parsed.type === "done") {
            const finalContent = streamingContentRef.current;
            if (finalContent) {
              const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                agent_id: id,
                role: "assistant",
                content: finalContent,
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
            }
            setStreamingContent("");
            streamingContentRef.current = "";
            setStatus("idle");
            es.close();
            esRef.current = null;
            // Reopen for next turn after brief delay
            setTimeout(() => {
              if (!cancelled) openEventSource();
            }, 500);
          } else if (parsed.type === "error") {
            setStatus("idle");
            setStreamingContent("");
            streamingContentRef.current = "";
          }
        } catch {
          // Ignore malformed SSE events
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setStatus("idle");
        setStreamingContent("");
        streamingContentRef.current = "";
        // Attempt reconnect after delay
        setTimeout(() => {
          if (!cancelled) openEventSource();
        }, 3000);
      };
    }

    openEventSource();

    return () => {
      cancelled = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [id]);

  // Auto-scroll to bottom when messages or streaming content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Optimistic add
    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      agent_id: id,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setStatus("thinking");

    try {
      const res = await fetch(`/api/agents/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Send failed:", err);
      }
    } catch (err) {
      console.error("Send error:", err);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter: default behavior (newline)
  }

  // Status indicator config
  const statusConfig = {
    idle: { dot: "bg-cyan-400", label: "idle", text: "text-cyan-400" },
    thinking: {
      dot: "bg-yellow-400 animate-pulse",
      label: "thinking",
      text: "text-yellow-400",
    },
    "using tool": {
      dot: "bg-purple-400 animate-pulse",
      label: "using tool",
      text: "text-purple-400",
    },
  } as const;

  const currentStatus = statusConfig[status];

  if (accessDenied) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="glass-card p-6 text-center">
          <p className="font-mono text-red-400 text-sm uppercase tracking-widest">
            Access denied — you do not own this agent.
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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="glass-card p-6 animate-pulse">
          <div className="h-4 bg-cyan-500/10 rounded mb-3 w-1/3" />
          <div className="h-4 bg-cyan-500/10 rounded mb-2 w-full" />
          <div className="h-4 bg-cyan-500/10 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col" style={{ minHeight: "calc(100vh - 64px)" }}>
      {/* Header */}
      <div className="glass-card p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/agent/${id}`}
            className="font-mono text-xs text-slate-400 hover:text-cyan-400 transition-colors uppercase tracking-widest"
          >
            &larr; Profile
          </Link>
          <span className="text-slate-600">|</span>
          <h1 className="font-[family-name:var(--font-syne)] text-lg font-bold text-cyan-400 uppercase tracking-wide">
            {agentName || "Chat"}
          </h1>
        </div>
        {/* Status chip */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${currentStatus.dot}`} />
          <span className={`font-mono text-xs uppercase tracking-widest ${currentStatus.text}`}>
            {currentStatus.label}
          </span>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
        {messages.length === 0 && !streamingContent && (
          <div className="text-center py-12 font-mono text-xs text-slate-500 uppercase tracking-widest">
            // No messages yet — send one to start
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[75%] px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 text-white font-light text-sm leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[75%] glass-card px-4 py-3 text-gray-200 font-light text-sm leading-relaxed">
                <span className="block font-mono text-[10px] text-cyan-400/60 uppercase tracking-widest mb-1">
                  agent
                </span>
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {/* Streaming bubble */}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[75%] glass-card px-4 py-3 text-gray-200 font-light text-sm leading-relaxed">
              <span className="block font-mono text-[10px] text-cyan-400/60 uppercase tracking-widest mb-1">
                agent
              </span>
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-cyan-400 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="glass-card p-3 sticky bottom-0 mt-auto">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Message your agent... (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none bg-transparent border border-cyan-500/20 text-white font-mono text-sm px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 px-5 py-2 bg-[#00f0ff] text-[#006970] font-[family-name:var(--font-syne)] font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_35px_rgba(0,240,255,0.5)] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
