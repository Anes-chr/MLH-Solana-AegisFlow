"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AccountModal } from "./AccountModal";
import type { BurnerWalletState } from "@/lib/solana/burner";
import {
  Wallet,
  Activity,
  Copy,
  Check,
  ChevronDown,
  Shield,
  Search,
  Cpu,
  FileText,
} from "lucide-react";

export interface WalletHeaderProps {
  burner: BurnerWalletState | null;
  onSelectBurner: (burner: BurnerWalletState | null) => void;
  activeTab?: "copilot" | "sentinel" | "scanner" | "docs";
  onSelectTab?: (tab: "copilot" | "sentinel" | "scanner" | "docs") => void;
}

export function WalletHeader({
  burner,
  onSelectBurner,
  activeTab = "copilot",
  onSelectTab,
}: WalletHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();

  const activeAddress =
    connected && publicKey
      ? publicKey.toBase58()
      : burner
      ? burner.pubkey
      : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!activeAddress || !mounted) return;
    let isCancelled = false;

    const updateBalance = async () => {
      try {
        const lamports = await connection.getBalance(
          publicKey || new (await import("@solana/web3.js")).PublicKey(activeAddress),
          "confirmed"
        );
        if (!isCancelled) {
          setBalance(lamports / LAMPORTS_PER_SOL);
        }
      } catch {
        if (!isCancelled) setBalance(0);
      }
    };

    updateBalance();
    const id = setInterval(updateBalance, 10000);
    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, [activeAddress, mounted, connection, publicKey]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeAddress) return;
    try {
      await navigator.clipboard.writeText(activeAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  if (!mounted) {
    return (
      <header className="w-full bg-[#FBFBFA] border-b border-[#E7E4DC] px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="h-7 w-32 bg-[#EFECE6] rounded animate-pulse" />
          <div className="h-7 w-28 bg-[#EFECE6] rounded animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="w-full bg-[#FBFBFA]/95 backdrop-blur-sm border-b border-[#E7E4DC] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => onSelectTab?.("copilot")}
            >
              <div className="h-7 w-7 rounded-md overflow-hidden shrink-0 border border-[#DDD9CE]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aegis-icon.svg"
                  alt="AegisFlow Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-[#1C1B1A]">
                  AegisFlow
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F3F1EC] text-[#66635D] border border-[#E7E4DC]">
                  Devnet
                </span>
              </div>
            </div>

            {/* Modular Desktop Navigation Tabs */}
            {onSelectTab && (
              <nav className="hidden md:flex items-center gap-1 border-l border-[#E7E4DC] pl-5 text-xs">
                <button
                  type="button"
                  onClick={() => onSelectTab("copilot")}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === "copilot"
                      ? "bg-[#1C1B1A] text-white font-medium"
                      : "text-[#66635D] hover:text-[#1C1B1A] hover:bg-[#F3F1EC]"
                  }`}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  <span>Copilot</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab("sentinel")}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === "sentinel"
                      ? "bg-[#1C1B1A] text-white font-medium"
                      : "text-[#66635D] hover:text-[#1C1B1A] hover:bg-[#F3F1EC]"
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>Sentinel Cockpit</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab("scanner")}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === "scanner"
                      ? "bg-[#1C1B1A] text-white font-medium"
                      : "text-[#66635D] hover:text-[#1C1B1A] hover:bg-[#F3F1EC]"
                  }`}
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Token Auditor</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab("docs")}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === "docs"
                      ? "bg-[#1C1B1A] text-white font-medium"
                      : "text-[#66635D] hover:text-[#1C1B1A] hover:bg-[#F3F1EC]"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Architecture &amp; Proofs</span>
                </button>
              </nav>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            {/* Live Helius RPC Status */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F3F1EC] border border-[#E7E4DC] text-[11px] text-[#4A4742]"
              title="Connected to Helius Devnet RPC"
            >
              <Activity className="h-3 w-3 text-emerald-600" />
              <span>Helius Devnet</span>
            </div>

            {/* Account / Wallet Trigger */}
            <button
              onClick={() => setIsModalOpen(true)}
              aria-label="Account and Wallet Settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1C1B1A] hover:bg-[#33312E] text-white text-xs font-medium transition shadow-sm"
            >
              <Wallet className="h-3.5 w-3.5" />
              {activeAddress ? (
                <>
                  <span className="font-mono">
                    {activeAddress.slice(0, 4)}...{activeAddress.slice(-4)}
                  </span>
                  {balance !== null && (
                    <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-mono">
                      {balance.toFixed(2)} SOL
                    </span>
                  )}
                  <span
                    onClick={handleCopy}
                    className="p-0.5 rounded hover:bg-white/20 text-slate-300 hover:text-white transition"
                    title="Copy Address"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </span>
                </>
              ) : (
                <span>Connect Wallet</span>
              )}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        {onSelectTab && (
          <div className="flex md:hidden border-t border-[#E7E4DC] px-4 py-1.5 gap-1 bg-[#F5F3ED] overflow-x-auto">
            <button
              type="button"
              onClick={() => onSelectTab("copilot")}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                activeTab === "copilot"
                  ? "bg-[#1C1B1A] text-white font-medium"
                  : "text-[#66635D]"
              }`}
            >
              Copilot
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("sentinel")}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                activeTab === "sentinel"
                  ? "bg-[#1C1B1A] text-white font-medium"
                  : "text-[#66635D]"
              }`}
            >
              Sentinel
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("scanner")}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                activeTab === "scanner"
                  ? "bg-[#1C1B1A] text-white font-medium"
                  : "text-[#66635D]"
              }`}
            >
              Token Auditor
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("docs")}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                activeTab === "docs"
                  ? "bg-[#1C1B1A] text-white font-medium"
                  : "text-[#66635D]"
              }`}
            >
              Proofs
            </button>
          </div>
        )}
      </header>

      {/* Account & Wallet Modal */}
      <AccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        burner={burner}
        onSelectBurner={onSelectBurner}
      />
    </>
  );
}
