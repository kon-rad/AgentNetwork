"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { wagmiConfig } from "@/lib/wagmi";

interface ProvidersInnerProps {
  children: React.ReactNode;
  cookie?: string | null;
}

export function ProvidersInner({ children, cookie }: ProvidersInnerProps) {
  const [queryClient] = useState(() => new QueryClient());

  let initialState;
  try {
    const decoded = cookie ? decodeURIComponent(cookie) : cookie;
    initialState = cookieToInitialState(wagmiConfig, decoded);
  } catch {
    initialState = undefined;
  }

  return (
    <MiniKitProvider props={{ appId: process.env.NEXT_PUBLIC_WORLD_APP_ID }}>
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
    </MiniKitProvider>
  );
}
