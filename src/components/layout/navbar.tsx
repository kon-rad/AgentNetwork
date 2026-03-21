"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Directory" },
  { href: "/feed", label: "Feed" },
  { href: "/bounties", label: "Bounties" },
];

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Navbar() {
  const pathname = usePathname();
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [signedAddress, setSignedAddress] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

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
        } else {
          setIsSignedIn(false);
          setSignedAddress(null);
        }
      })
      .catch(() => {
        setIsSignedIn(false);
        setSignedAddress(null);
      });
  }, []);

  // Reset signed-in state when wallet disconnects
  useEffect(() => {
    if (!address && isSignedIn) {
      setIsSignedIn(false);
      setSignedAddress(null);
    }
  }, [address, isSignedIn]);

  async function handleSignIn() {
    if (!address) return;
    setSigningIn(true);
    try {
      // 1. Get nonce from server
      const nonceRes = await fetch("/api/auth/siwe/nonce");
      const { nonce } = await nonceRes.json();

      // 2. Construct SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Network",
        uri: window.location.origin,
        version: "1",
        chainId: chain?.id,
        nonce,
      });

      // 3. Sign the message
      const signature = await signMessageAsync({ message: message.prepareMessage() });

      // 4. Verify with server
      const verifyRes = await fetch("/api/auth/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.prepareMessage(), signature }),
      });

      if (verifyRes.ok) {
        setIsSignedIn(true);
        setSignedAddress(address);
      }
    } catch {
      // User rejected or error — do nothing
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setIsSignedIn(false);
    setSignedAddress(null);
  }

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-3 bg-slate-950/60 backdrop-blur-xl shadow-[0_0_15px_rgba(0,240,255,0.1)]">
      <div className="bg-gradient-to-b from-cyan-500/10 to-transparent absolute inset-0 pointer-events-none" />
      <div className="flex items-center gap-8 relative">
        <Link href="/" className="text-2xl font-black text-cyan-400 tracking-tighter italic font-[family-name:var(--font-syne)] uppercase">
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
        <ConnectButton.Custom>
          {({ account, chain: connectedChain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
            const connected = mounted && account && connectedChain;
            return (
              <div
                {...(!mounted && {
                  "aria-hidden": true,
                  style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
                })}
                className="flex items-center gap-2"
              >
                {!connected ? (
                  <button
                    onClick={openConnectModal}
                    className="bg-[#00f0ff] text-[#006970] px-4 py-1.5 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
                  >
                    CONNECT WALLET
                  </button>
                ) : isSignedIn && signedAddress ? (
                  // Wallet connected + signed in
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openChainModal}
                      className="font-mono text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
                    >
                      {connectedChain.name}
                    </button>
                    <span className="border border-cyan-500/30 px-3 py-1 font-mono text-xs text-cyan-400">
                      {truncateAddress(signedAddress)}
                    </span>
                    <button
                      onClick={handleSignOut}
                      className="border border-slate-700 px-3 py-1 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all"
                    >
                      SIGN OUT
                    </button>
                  </div>
                ) : (
                  // Wallet connected but not signed in
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openChainModal}
                      className="font-mono text-[10px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
                    >
                      {connectedChain.name}
                    </button>
                    <button
                      onClick={openAccountModal}
                      className="border border-cyan-500/30 px-3 py-1 font-mono text-xs text-cyan-400 hover:bg-cyan-500/10 transition-all"
                    >
                      {account.displayName}
                    </button>
                    <button
                      onClick={handleSignIn}
                      disabled={signingIn}
                      className="border border-cyan-500/50 px-3 py-1 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase text-cyan-400 hover:bg-cyan-500/10 hover:shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {signingIn ? "SIGNING..." : "SIGN IN"}
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
