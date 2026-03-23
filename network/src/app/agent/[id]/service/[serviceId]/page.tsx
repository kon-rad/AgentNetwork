"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Service } from "@/lib/types";

const BASESCAN_TOKEN_URL =
  "https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

export default function ServiceDetailPage() {
  const { id, serviceId } = useParams<{ id: string; serviceId: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/services/${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        setService(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [serviceId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="h-8 w-48 shimmer mb-6" />
        <div className="glass-card p-8 space-y-4">
          <div className="h-12 w-96 shimmer" />
          <div className="h-6 w-64 shimmer" />
          <div className="h-40 w-full shimmer" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="font-mono text-2xl text-slate-400">Service not found</h1>
        <Link href={`/agent/${id}`} className="text-cyan-400 hover:underline mt-4 inline-block">
          Back to agent profile
        </Link>
      </div>
    );
  }

  const examples = service.examples ? JSON.parse(service.examples) : [];
  const requirements = service.requirements ? JSON.parse(service.requirements) : [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-8 font-mono text-xs text-slate-500">
        <Link href={`/agent/${id}`} className="text-cyan-400 hover:underline">
          {service.agent_display_name}
        </Link>
        <span>/</span>
        <span className="text-slate-400">Services</span>
        <span>/</span>
        <span className="text-[#e1e2ea]">{service.title}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Title + category */}
          <div>
            <h1 className="font-[family-name:var(--font-syne)] text-4xl md:text-5xl font-extrabold tracking-tighter text-cyan-400">
              {service.title}
            </h1>
            {service.category && (
              <span className="inline-block mt-3 px-3 py-1 text-[10px] font-mono uppercase tracking-widest bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                {service.category}
              </span>
            )}
          </div>

          {/* Description */}
          <section className="relative p-6 bg-slate-900/40 backdrop-blur-md border border-cyan-500/10">
            <div className="hud-bracket-tl" />
            <div className="hud-bracket-tr" />
            <div className="hud-bracket-bl" />
            <div className="hud-bracket-br" />
            <h3 className="font-mono text-cyan-400 text-xs uppercase mb-3 opacity-60">
              // Service Description
            </h3>
            <p className="text-[#e1e2ea] font-light leading-relaxed whitespace-pre-line">
              {service.description}
            </p>
          </section>

          {/* Examples */}
          {examples.length > 0 && (
            <section className="relative p-6 bg-slate-900/40 backdrop-blur-md border border-cyan-500/10">
              <div className="hud-bracket-tl" />
              <div className="hud-bracket-tr" />
              <div className="hud-bracket-bl" />
              <div className="hud-bracket-br" />
              <h3 className="font-mono text-cyan-400 text-xs uppercase mb-4 opacity-60">
                // Portfolio / Examples
              </h3>
              <ul className="space-y-3">
                {examples.map((example: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-cyan-400 font-mono text-sm mt-0.5">{String(i + 1).padStart(2, "0")}.</span>
                    <span className="text-[#e1e2ea] font-light">{example}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Requirements */}
          {requirements.length > 0 && (
            <section className="relative p-6 bg-slate-900/40 backdrop-blur-md border border-cyan-500/10">
              <div className="hud-bracket-tl" />
              <div className="hud-bracket-tr" />
              <div className="hud-bracket-bl" />
              <div className="hud-bracket-br" />
              <h3 className="font-mono text-cyan-400 text-xs uppercase mb-4 opacity-60">
                // Requirements from Client
              </h3>
              <ul className="space-y-2">
                {requirements.map((req: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-[#f6be37] font-mono text-xs mt-1">&#9656;</span>
                    <span className="text-[#e1e2ea] font-light">{req}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Pricing card */}
          <div className="relative p-6 bg-[#191c21] border border-cyan-500/20">
            <div className="hud-bracket-tl" />
            <div className="hud-bracket-tr" />
            <div className="hud-bracket-bl" />
            <div className="hud-bracket-br" />
            {service.price ? (
              <div className="mb-4">
                <div className="font-mono text-[10px] text-slate-500 uppercase mb-1">Starting at</div>
                <div className="font-mono text-3xl text-[#00f0ff] font-bold">
                  {service.price} <span className="text-lg text-slate-400">{service.price_token}</span>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div className="font-mono text-[10px] text-slate-500 uppercase mb-1">Price</div>
                <div className="font-mono text-lg text-slate-400">Contact for quote</div>
              </div>
            )}

            {service.delivery_time && (
              <div className="mb-4">
                <div className="font-mono text-[10px] text-slate-500 uppercase mb-1">Delivery</div>
                <div className="font-mono text-sm text-[#e1e2ea]">{service.delivery_time}</div>
              </div>
            )}

            <button className="w-full mt-2 py-3 bg-[#00f0ff] text-[#006970] font-[family-name:var(--font-syne)] font-black text-sm uppercase tracking-widest shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.6)] active:scale-95 transition-all">
              Hire Agent
            </button>
          </div>

          {/* Agent card */}
          <div className="relative p-4 bg-[#191c21] border border-cyan-500/20">
            <Link href={`/agent/${id}`} className="flex items-center gap-3 group">
              <div className="w-12 h-12 bg-slate-900 flex items-center justify-center border border-cyan-500/30 overflow-hidden shrink-0">
                {service.agent_avatar_url ? (
                  <img src={service.agent_avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-cyan-400 font-mono">
                    {service.agent_display_name?.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <div className="font-[family-name:var(--font-syne)] font-bold text-cyan-400 group-hover:underline">
                  {service.agent_display_name}
                </div>
                {service.agent_service_type && (
                  <div className={`text-[10px] font-mono uppercase tracking-widest badge-${service.agent_service_type} inline-block px-2 py-0.5 mt-1`}>
                    {service.agent_service_type}
                  </div>
                )}
              </div>
            </Link>
          </div>

          {/* ERC-8004 link */}
          {service.agent_erc8004_token_id && (
            <a
              href={`${BASESCAN_TOKEN_URL}?a=${service.agent_erc8004_token_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative p-4 bg-[#191c21] border border-cyan-500/20 hover:border-cyan-500/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-500/10 flex items-center justify-center border border-cyan-400/30">
                  <span className="text-cyan-400 text-xs font-mono font-bold">ID</span>
                </div>
                <div>
                  <div className="font-mono text-xs text-cyan-400 group-hover:underline">
                    ERC-8004 #{service.agent_erc8004_token_id}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">View on BaseScan</div>
                </div>
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
