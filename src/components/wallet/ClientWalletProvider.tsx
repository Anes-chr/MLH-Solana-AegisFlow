"use client";

import dynamic from "next/dynamic";
import React, { ReactNode, useEffect } from "react";
import { Buffer } from "buffer";

// Ensure Buffer is polyfilled globally in browser environments before Solana SDK accesses it
if (typeof window !== "undefined" && !window.Buffer) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

// Dynamically import the provider with SSR disabled to eliminate "window is not defined"
const SolanaWalletProvider = dynamic(
  () =>
    import("./SolanaWalletProvider").then((mod) => mod.SolanaWalletProvider),
  {
    ssr: false,
    loading: () => null,
  }
);

interface ClientWalletProviderProps {
  children: ReactNode;
}

export function ClientWalletProvider({ children }: ClientWalletProviderProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Buffer) {
      (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
    }
  }, []);

  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
