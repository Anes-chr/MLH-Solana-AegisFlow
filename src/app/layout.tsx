import type { Metadata } from "next";
import "./globals.css";
import { ClientWalletProvider } from "@/components/wallet/ClientWalletProvider";

export const metadata: Metadata = {
  title: "AegisFlow — Autonomous DeFi Copilot & Pre-Flight Guardrails",
  description:
    "Autonomous intent-driven Solana DeFi copilot with pre-flight transaction simulation, deterministic safety guardrails, and 1-click Solana Blinks.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/aegis-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-[#080912] text-slate-100 antialiased font-sans selection:bg-violet-600/30 selection:text-violet-200">
        <ClientWalletProvider>{children}</ClientWalletProvider>
      </body>
    </html>
  );
}
