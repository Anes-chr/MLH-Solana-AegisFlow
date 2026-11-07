import type { Metadata } from "next";
import "./globals.css";
import { ClientWalletProvider } from "@/components/wallet/ClientWalletProvider";

export const metadata: Metadata = {
  title: "AegisFlow — Pro AI DeFi Copilot & Pre-Flight Guardrails",
  description:
    "Autonomous intent-driven DeFi copilot with pre-flight transaction simulation, deterministic safety guardrails, and 1-click Solana Blinks.",
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
      <body className="min-h-screen bg-[#07090E] text-slate-100 antialiased font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
        <ClientWalletProvider>{children}</ClientWalletProvider>
      </body>
    </html>
  );
}
