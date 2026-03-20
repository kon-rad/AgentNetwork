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
    <nav className="border-b border-[--color-border] bg-[--color-bg-primary]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-[--color-cyan] text-glow-cyan">
          NETWORK
        </Link>
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[--color-cyan]/10 text-[--color-cyan]"
                    : "text-[--color-text-secondary] hover:text-[--color-text-primary] hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex justify-end">
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
        </div>
      </div>
    </nav>
  );
}
