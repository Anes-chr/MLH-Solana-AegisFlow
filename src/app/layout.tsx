import type { Metadata } from "next";
import "./globals.css";
import { ClientWalletProvider } from "@/components/wallet/ClientWalletProvider";

export const metadata: Metadata = {
  title: "AegisFlow — AI DeFi Copilot with Pre-Flight Guardrails",
  description:
    "Natural language Solana transactions with pre-flight simulation and guardrails on Solana Devnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
        <ClientWalletProvider>{children}</ClientWalletProvider>
      </body>
    </html>
  );
}
