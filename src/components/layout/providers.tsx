"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { WagmiProvider, cookieToInitialState } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

interface ProvidersProps {
  children: React.ReactNode;
  cookie?: string | null;
}

export function Providers({ children, cookie }: ProvidersProps) {
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
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
