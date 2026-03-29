"use client";

import { useState, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { MiniKit } from "@worldcoin/minikit-js";
import { wagmiConfig } from "@/lib/wagmi";

interface ProvidersInnerProps {
  children: React.ReactNode;
  cookie?: string | null;
}

/**
 * Wraps children in Wagmi + RainbowKit providers (desktop only).
 * Skipped inside World App to avoid WalletConnect/IndexedDB crashes
 * in the restricted WebView environment.
 */
function DesktopProviders({ children, cookie }: { children: ReactNode; cookie?: string | null }) {
  const [queryClient] = useState(() => new QueryClient());

  let initialState;
  try {
    const decoded = cookie ? decodeURIComponent(cookie) : cookie;
    initialState = cookieToInitialState(wagmiConfig, decoded);
  } catch {
    initialState = undefined;
  }

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00f0ff",
            accentColorForeground: "#00363a",
            borderRadius: "none",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/**
 * Minimal provider for World App context.
 * No Wagmi/RainbowKit — MiniKit handles wallet interactions natively.
 */
function MiniAppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export function ProvidersInner({ children, cookie }: ProvidersInnerProps) {
  const [isMiniKit, setIsMiniKit] = useState<boolean | null>(null);

  useEffect(() => {
    // Detect World App environment after mount
    setIsMiniKit(MiniKit.isInstalled());
  }, []);

  // Show nothing until we know the environment (prevents flash)
  if (isMiniKit === null) {
    return (
      <MiniKitProvider props={{ appId: process.env.NEXT_PUBLIC_WORLD_APP_ID }}>
        <div className="min-h-screen bg-[#111319]" />
      </MiniKitProvider>
    );
  }

  return (
    <MiniKitProvider props={{ appId: process.env.NEXT_PUBLIC_WORLD_APP_ID }}>
      {isMiniKit ? (
        <MiniAppProviders>{children}</MiniAppProviders>
      ) : (
        <DesktopProviders cookie={cookie}>{children}</DesktopProviders>
      )}
    </MiniKitProvider>
  );
}
