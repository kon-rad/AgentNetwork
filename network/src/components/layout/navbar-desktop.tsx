"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import { useState, useEffect, useRef, useCallback } from "react";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Desktop-only navbar auth component.
 *
 * Separated into its own file so wagmi/RainbowKit hooks are never
 * imported or evaluated inside World App's WebView, which would crash
 * due to missing WagmiProvider and restricted browser APIs.
 */
export function NavbarDesktopAuth({
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
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signingIn, setSigningIn] = useState(false);
  const pendingSignIn = useRef(false);
  const prevAddress = useRef<string | undefined>(undefined);

  // Reset signed-in state on real disconnect
  useEffect(() => {
    if (prevAddress.current && !address && isSignedIn) {
      fetch("/api/auth/signout", { method: "POST" });
      onSignOut();
    }
    prevAddress.current = address;
  }, [address, isSignedIn, onSignOut]);

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
        onSignedIn(address);
      }
    } catch {
      // User rejected or error
    } finally {
      setSigningIn(false);
      pendingSignIn.current = false;
    }
  }, [address, chain?.id, signMessageAsync, onSignedIn]);

  // Auto-trigger SIWE after wallet connects
  useEffect(() => {
    if (address && !isSignedIn && !signingIn && pendingSignIn.current) {
      handleSignIn();
    }
  }, [address, isSignedIn, signingIn, handleSignIn]);

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
  );
}
