"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { MiniKit } from "@worldcoin/minikit-js";
import { useState, useEffect, useRef, useCallback } from "react";

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
 * Uses MiniKit.commandsAsync.walletAuth which produces a SIWE payload
 * verified by /api/auth/minikit/verify, creating the same iron-session.
 */
function MiniKitSignIn({
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
      // 1. Get nonce from the same endpoint (reuses existing nonce route)
      const nonceRes = await fetch("/api/auth/siwe/nonce");
      const { nonce } = await nonceRes.json();

      // 2. Call MiniKit walletAuth — prompts user in World App
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

      // 3. Verify with our MiniKit-specific endpoint
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
 * RainbowKit sign-in flow for desktop browser users.
 * Existing SIWE flow — unchanged from before MiniKit integration.
 */
function RainbowKitSignIn({
  isSignedIn,
  signedAddress,
  signingIn,
  onSignIn,
  onSignOut,
  pendingSignIn,
}: {
  isSignedIn: boolean;
  signedAddress: string | null;
  signingIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  pendingSignIn: React.MutableRefObject<boolean>;
}) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain: connectedChain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && connectedChain;
        return (
          <div
            {...(!mounted && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
            className="flex items-center gap-2"
          >
            {!connected ? (
              <button
                onClick={() => {
                  pendingSignIn.current = true;
                  openConnectModal();
                }}
                className="bg-[#00f0ff] text-[#006970] px-4 py-1.5 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
              >
                CONNECT WALLET
              </button>
            ) : isSignedIn && signedAddress ? (
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
                  onClick={onSignOut}
                  className="border border-slate-700 px-3 py-1 font-[family-name:var(--font-syne)] font-bold text-xs tracking-widest uppercase text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all"
                >
                  SIGN OUT
                </button>
              </div>
            ) : (
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
                  onClick={onSignIn}
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
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [signedAddress, setSignedAddress] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isMiniKit, setIsMiniKit] = useState(false);
  const pendingSignIn = useRef(false);
  const prevAddress = useRef<string | undefined>(undefined);

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
        } else {
          setIsSignedIn(false);
          setSignedAddress(null);
        }
      })
      .catch(() => {
        setIsSignedIn(false);
        setSignedAddress(null);
      })
      .finally(() => {
        setSessionChecked(true);
      });
  }, []);

  // Reset signed-in state only on real disconnect (desktop only)
  useEffect(() => {
    if (!isMiniKit && prevAddress.current && !address && isSignedIn) {
      fetch("/api/auth/signout", { method: "POST" });
      setIsSignedIn(false);
      setSignedAddress(null);
    }
    prevAddress.current = address;
  }, [address, isSignedIn, isMiniKit]);

  const handleSignIn = useCallback(async () => {
    if (!address) return;
    setSigningIn(true);
    try {
      const nonceRes = await fetch("/api/auth/siwe/nonce");
      const { nonce } = await nonceRes.json();

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Network",
        uri: window.location.origin,
        version: "1",
        chainId: chain?.id,
        nonce,
      });

      const signature = await signMessageAsync({
        message: message.prepareMessage(),
      });

      const verifyRes = await fetch("/api/auth/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.prepareMessage(),
          signature,
        }),
      });

      if (verifyRes.ok) {
        setIsSignedIn(true);
        setSignedAddress(address);
      }
    } catch {
      // User rejected or error — do nothing
    } finally {
      setSigningIn(false);
      pendingSignIn.current = false;
    }
  }, [address, chain?.id, signMessageAsync]);

  // Auto-trigger SIWE sign-in after wallet connects (desktop only)
  useEffect(() => {
    if (
      !isMiniKit &&
      sessionChecked &&
      address &&
      !isSignedIn &&
      !signingIn &&
      pendingSignIn.current
    ) {
      handleSignIn();
    }
  }, [isMiniKit, sessionChecked, address, isSignedIn, signingIn, handleSignIn]);

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
        {isMiniKit ? (
          <MiniKitSignIn
            isSignedIn={isSignedIn}
            signedAddress={signedAddress}
            onSignIn={(addr) => {
              setIsSignedIn(true);
              setSignedAddress(addr);
            }}
            onSignOut={handleSignOut}
          />
        ) : (
          <RainbowKitSignIn
            isSignedIn={isSignedIn}
            signedAddress={signedAddress}
            signingIn={signingIn}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            pendingSignIn={pendingSignIn}
          />
        )}
      </div>
    </header>
  );
}
