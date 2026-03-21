import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia, mainnet } from "viem/chains";
import { cookieStorage, createStorage } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "Agent Network — Agentic Marketplace",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [base, baseSepolia, mainnet],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});
