"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Service, ServicePayment } from "@/lib/types";

const BASESCAN_TOKEN_URL =
  "https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PaymentRow({ payment }: { payment: ServicePayment }) {
  const statusColors: Record<string, string> = {
    confirmed: "text-[#00e479]",
    pending: "text-[#f6be37]",
    failed: "text-red-400",
  };

  const statusBg: Record<string, string> = {
    confirmed: "bg-[#00e479]/10 border-[#00e479]/20",
    pending: "bg-[#f6be37]/10 border-[#f6be37]/20",
    failed: "bg-red-500/10 border-red-500/20",
  };

  return (
    <div className="p-4 bg-[#191c21] border border-cyan-500/10 hover:border-cyan-500/20 transition-colors">
      {/* Top row: status + amount + time */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${statusBg[payment.status]} ${statusColors[payment.status]}`}>
            {payment.status}
          </span>
          <span className="font-mono text-sm text-[#00f0ff] font-bold">
            {payment.amount} <span className="text-xs text-slate-400">{payment.token}</span>
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          {timeAgo(payment.created_at)}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Payer */}
        <div>
          <div className="font-mono text-[10px] text-slate-500 uppercase mb-0.5">Payer</div>
          <div className="font-mono text-xs text-slate-300">
            {payment.payer_display_name ? (
              <span>{payment.payer_display_name} <span className="text-slate-500">({truncateAddress(payment.payer_address)})</span></span>
            ) : (
              <span>{truncateAddress(payment.payer_address)}</span>
            )}
          </div>
        </div>

        {/* Network */}
        <div>
          <div className="font-mono text-[10px] text-slate-500 uppercase mb-0.5">Network</div>
          <div className="font-mono text-xs text-slate-300">
            {payment.network === "eip155:8453" ? "Base Mainnet" : payment.network}
          </div>
        </div>
      </div>

      {/* Transaction hash + BaseScan link */}
      {payment.tx_hash && (
        <div className="mt-3 pt-3 border-t border-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] text-slate-500 uppercase mb-0.5">Transaction</div>
              <code className="font-mono text-xs text-slate-400">{truncateHash(payment.tx_hash)}</code>
            </div>
            <a
              href={`https://basescan.org/tx/${payment.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-[10px] text-cyan-400 hover:text-cyan-300 uppercase tracking-wider transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
              BaseScan
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ServiceDetailPage() {
  const { id, serviceId } = useParams<{ id: string; serviceId: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [payments, setPayments] = useState<ServicePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/services/${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        setService(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`/api/services/${serviceId}/payments`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPayments(data);
        setPaymentsLoading(false);
      })
      .catch(() => setPaymentsLoading(false));
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
  const confirmedPayments = payments.filter(p => p.status === "confirmed");
  const totalPaid = confirmedPayments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);

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

          {/* Payment History */}
          <section className="relative p-6 bg-slate-900/40 backdrop-blur-md border border-cyan-500/10">
            <div className="hud-bracket-tl" />
            <div className="hud-bracket-tr" />
            <div className="hud-bracket-bl" />
            <div className="hud-bracket-br" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-cyan-400 text-xs uppercase opacity-60">
                // Payment History
              </h3>
              {confirmedPayments.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-slate-500 uppercase">
                    {confirmedPayments.length} payment{confirmedPayments.length !== 1 ? "s" : ""}
                  </span>
                  <span className="font-mono text-xs text-[#00e479] font-bold">
                    {totalPaid.toFixed(2)} USDC
                  </span>
                </div>
              )}
            </div>

            {paymentsLoading ? (
              <div className="space-y-3">
                <div className="h-20 shimmer" />
                <div className="h-20 shimmer" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 font-mono text-sm text-slate-500 uppercase">
                No payments yet
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </div>
            )}
          </section>
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

          {/* Payment stats card */}
          {confirmedPayments.length > 0 && (
            <div className="relative p-4 bg-[#191c21] border border-[#00e479]/20">
              <div className="font-mono text-[10px] text-slate-500 uppercase mb-2">Service Revenue</div>
              <div className="font-mono text-2xl text-[#00e479] font-bold">
                {totalPaid.toFixed(2)} <span className="text-sm text-slate-400">USDC</span>
              </div>
              <div className="font-mono text-[10px] text-slate-500 mt-1">
                {confirmedPayments.length} confirmed payment{confirmedPayments.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

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
