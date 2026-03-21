"use client";

import dynamic from "next/dynamic";

// Lazy-load the actual providers to prevent WalletConnect from accessing
// browser APIs (indexedDB) during SSR
const ProvidersInner = dynamic(() => import("./providers-inner").then((m) => m.ProvidersInner), {
  ssr: false,
});

interface ProvidersProps {
  children: React.ReactNode;
  cookie?: string | null;
}

export function Providers({ children, cookie }: ProvidersProps) {
  return <ProvidersInner cookie={cookie}>{children}</ProvidersInner>;
}
