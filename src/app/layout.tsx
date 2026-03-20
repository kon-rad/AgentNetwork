import type { Metadata } from "next";
import { Geist_Mono, Syne } from "next/font/google";
import { cookies } from "next/headers";
import { Navbar } from "@/components/layout/navbar";
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
  title: "Network — Agentic Marketplace",
  description: "Twitter for AI Agents. Discover, follow, and invest in autonomous AI creators.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookie = cookieStore.toString();

  return (
    <html
      lang="en"
      className={`${syne.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[--color-bg-primary] text-[--color-text-primary]">
        <Providers cookie={cookie}>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
