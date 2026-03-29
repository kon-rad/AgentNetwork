"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MiniKit } from "@worldcoin/minikit-js";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/launch", label: "Launch" },
  { href: "/", label: "Directory" },
  { href: "/feed", label: "Feed" },
  { href: "/bounties", label: "Bounties" },
];

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * MiniKit sign-in flow for World App users.
 */
function MiniKitAuth({
  isSignedIn,
  signedAddress,
  onSignIn,
  onSignOut,
}: {
  isSignedIn: boolean;
  signedAddress: string | null;
  onSignIn: (address: string) => void;
  onSignOut: () => void;
}) {
  const [signingIn, setSigningIn] = useState(false);

  const handleMiniKitSignIn = async () => {
    setSigningIn(true);
    try {
      const nonceRes = await fetch("/api/auth/siwe/nonce");
      const { nonce } = await nonceRes.json();

      const result = await MiniKit.walletAuth({
        nonce,
        expirationTime: new Date(
          new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
        ),
        statement: "Sign in to Agent Network",
      });

      if (!result.data?.address) {
        return;
      }

      const verifyRes = await fetch("/api/auth/minikit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            status: "success",
            message: result.data.message,
            signature: result.data.signature,
            address: result.data.address,
          },
          nonce,
        }),
      });

      if (verifyRes.ok) {
        const data = await verifyRes.json();
        onSignIn(data.address || result.data.address || "");
      }
    } catch {
      // User rejected or error
    } finally {
      setSigningIn(false);
    }
  };

  if (isSignedIn && signedAddress) {
    return (
      <div className="flex items-center gap-2">
        <span className="border border-cyan-500/30 px-3 py-1 font-mono text-xs text-cyan-400">
          {truncateAddress(signedAddress)}
        </span>
        <button
          onClick={onSignOut}
          className="border border-slate-700 px-3 py-1 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all"
        >
          SIGN OUT
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleMiniKitSignIn}
      disabled={signingIn}
      className="bg-[#00f0ff] text-[#006970] px-4 py-1.5 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {signingIn ? "SIGNING..." : "SIGN IN WITH WORLD"}
    </button>
  );
}

/**
 * Desktop auth — loaded lazily to avoid importing wagmi/rainbowkit in World App.
 * Uses dynamic import so the wagmi hooks are never evaluated in MiniKit context.
 */
function DesktopAuth({
  isSignedIn,
  signedAddress,
  onSignedIn,
  onSignOut,
}: {
  isSignedIn: boolean;
  signedAddress: string | null;
  onSignedIn: (addr: string) => void;
  onSignOut: () => void;
}) {
  const [DesktopComponent, setDesktopComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    // Dynamically import the desktop navbar to avoid wagmi hooks in World App
    import("./navbar-desktop").then((mod) => {
      setDesktopComponent(() => mod.NavbarDesktopAuth);
    });
  }, []);

  if (!DesktopComponent) {
    return (
      <div className="bg-[#00f0ff] text-[#006970] px-4 py-1.5 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase opacity-50">
        LOADING...
      </div>
    );
  }

  return (
    <DesktopComponent
      isSignedIn={isSignedIn}
      signedAddress={signedAddress}
      onSignedIn={onSignedIn}
      onSignOut={onSignOut}
    />
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [signedAddress, setSignedAddress] = useState<string | null>(null);
  const [isMiniKit, setIsMiniKit] = useState<boolean | null>(null);

  // Detect MiniKit environment on mount
  useEffect(() => {
    setIsMiniKit(MiniKit.isInstalled());
  }, []);

  // Check session on mount
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.address) {
          setIsSignedIn(true);
          setSignedAddress(data.address);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setIsSignedIn(false);
    setSignedAddress(null);
  }

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-3 bg-slate-950/60 backdrop-blur-xl shadow-[0_0_15px_rgba(0,240,255,0.1)]">
      <div className="bg-gradient-to-b from-cyan-500/10 to-transparent absolute inset-0 pointer-events-none" />
      <div className="flex items-center gap-8 relative">
        <Link
          href="/"
          className="text-2xl font-black text-cyan-400 tracking-tighter italic font-[family-name:var(--font-syne)] uppercase"
        >
          AGENT NETWORK
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
        {isMiniKit === null ? null : isMiniKit ? (
          <MiniKitAuth
            isSignedIn={isSignedIn}
            signedAddress={signedAddress}
            onSignIn={(addr) => {
              setIsSignedIn(true);
              setSignedAddress(addr);
            }}
            onSignOut={handleSignOut}
          />
        ) : (
          <DesktopAuth
            isSignedIn={isSignedIn}
            signedAddress={signedAddress}
            onSignedIn={(addr) => {
              setIsSignedIn(true);
              setSignedAddress(addr);
            }}
            onSignOut={handleSignOut}
          />
        )}
      </div>
    </header>
  );
}
