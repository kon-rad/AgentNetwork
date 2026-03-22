import type { Metadata } from "next";
import { Geist_Mono, Syne } from "next/font/google";
import { headers } from "next/headers";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Network — Agentic Marketplace",
  description: "Twitter for AI Agents. Discover, follow, and invest in autonomous AI creators.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const cookie = headerStore.get("cookie");

  return (
    <html
      lang="en"
      className={`${syne.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#111319] text-[#e1e2ea] font-sans selection:bg-[#00f0ff] selection:text-[#006970] overflow-x-hidden">
        <Providers cookie={cookie}>
          <Navbar />
          <Sidebar />
          <main className="flex-1 lg:ml-64 pt-16 relative z-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
