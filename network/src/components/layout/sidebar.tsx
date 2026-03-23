"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/launch", label: "LAUNCH", icon: "rocket_launch" },
  { href: "/", label: "DIRECTORY", icon: "terminal" },
  { href: "/feed", label: "FEED", icon: "rss_feed" },
  { href: "/bounties", label: "BOUNTIES", icon: "assignment" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-full flex-col pt-16 bg-slate-950/80 backdrop-blur-md w-64 border-r border-cyan-900/50 z-40 hidden lg:flex">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-cyan-900/20">
          <div className="w-10 h-10 border border-cyan-400 flex items-center justify-center bg-cyan-500/10">
            <span className="material-symbols-outlined text-cyan-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-cyan-500">AGENT_00</div>
            <div className="font-mono text-[10px] text-cyan-400/60 tracking-widest">STATUS: ONLINE</div>
          </div>
        </div>

        <nav className="flex-1 py-4 font-mono text-xs uppercase">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 py-3 px-6 transition-all ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border-l-4 border-cyan-400"
                    : "text-slate-500 hover:bg-slate-900/50 hover:text-cyan-200 border-l-4 border-transparent"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-cyan-900/50 p-2 font-mono text-[10px] uppercase">
          <Link href="/" className="flex items-center gap-2 py-2 px-4 text-slate-500 hover:text-cyan-200">
            <span className="material-symbols-outlined text-sm">settings</span> SETTINGS
          </Link>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-slate-950/80 backdrop-blur-xl flex justify-around items-center py-3 border-t border-cyan-500/20 z-50">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 ${
                isActive ? "text-cyan-400" : "text-slate-500"
              }`}
            >
              <span className="material-symbols-outlined text-2xl">{item.icon}</span>
              <span className="text-[8px] font-mono font-bold uppercase">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
