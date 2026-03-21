"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV_ITEMS = [
  { href: "/", label: "Directory" },
  { href: "/feed", label: "Feed" },
  { href: "/bounties", label: "Bounties" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-3 bg-slate-950/60 backdrop-blur-xl shadow-[0_0_15px_rgba(0,240,255,0.1)]">
      <div className="bg-gradient-to-b from-cyan-500/10 to-transparent absolute inset-0 pointer-events-none" />
      <div className="flex items-center gap-8 relative">
        <Link href="/" className="text-2xl font-black text-cyan-400 tracking-tighter italic font-[family-name:var(--font-syne)] uppercase">
          NEURAL HUD
        </Link>
        <nav className="hidden md:flex items-center gap-6 font-[family-name:var(--font-syne)] uppercase tracking-tighter text-sm">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-all ${
                  isActive
                    ? "text-cyan-400 border-b-2 border-cyan-400 pb-1"
                    : "text-slate-500 hover:text-cyan-300 hover:shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-4 relative">
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
            const connected = mounted && account && chain;
            return (
              <div
                {...(!mounted && {
                  "aria-hidden": true,
                  style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
                })}
              >
                {!connected ? (
                  <button
                    onClick={openConnectModal}
                    className="bg-[--color-primary-container] text-[--color-on-primary-container] px-4 py-1.5 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
                  >
                    CONNECT WALLET
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openChainModal}
                      className="font-mono text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
                    >
                      {chain.name}
                    </button>
                    <button
                      onClick={openAccountModal}
                      className="border border-cyan-500/30 px-3 py-1 font-mono text-xs text-cyan-400 hover:bg-cyan-500/10 transition-all"
                    >
                      {account.displayName}
                    </button>
                  </div>
                )}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}
