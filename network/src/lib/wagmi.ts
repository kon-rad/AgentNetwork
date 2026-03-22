import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, mainnet } from "viem/chains";
import { cookieStorage, createStorage } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "Agent Network — Agentic Marketplace",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [base, mainnet],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});
