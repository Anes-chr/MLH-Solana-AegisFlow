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
} from "lucide-react";

export interface WalletHeaderProps {
  burner: BurnerWalletState | null;
  onSelectBurner: (burner: BurnerWalletState | null) => void;
  activeTab?: "copilot" | "scanner";
  onSelectTab?: (tab: "copilot" | "scanner") => void;
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
      <header className="w-full sticky top-3 z-40 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 py-3 rounded-full bg-[#0E0F1E]/80 backdrop-blur-xl border border-white/10 shadow-lg">
          <div className="h-8 w-32 bg-white/5 rounded-full animate-pulse" />
          <div className="h-8 w-40 bg-white/5 rounded-full animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="w-full sticky top-3 z-40 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-3.5 sm:px-5 py-2.5 rounded-full bg-[#0D0E1C]/90 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6),0_0_24px_-6px_rgba(105,40,234,0.2)]">
          {/* Left: Brand Emblem + Wordmark */}
          <div className="flex items-center gap-5 sm:gap-7">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => onSelectTab?.("copilot")}
            >
              <div className="h-9 w-9 rounded-xl overflow-hidden shrink-0 shadow-md group-hover:scale-105 transition-transform duration-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aegis-icon.svg"
                  alt="AegisFlow Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base tracking-tight text-white group-hover:text-violet-200 transition-colors">
                    AegisFlow
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    DEVNET
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block -mt-0.5 font-medium">
                  Autonomous DeFi Guardrails
                </span>
              </div>
            </div>

            {/* Desktop Capsule Tabs */}
            {onSelectTab && (
              <nav className="hidden md:flex items-center gap-1 rounded-full bg-black/40 p-1 border border-white/5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => onSelectTab("copilot")}
                  className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                    activeTab === "copilot"
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Copilot &amp; Sentinel
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab("scanner")}
                  className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                    activeTab === "scanner"
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Token Safety Scanner
                </button>
              </nav>
            )}
          </div>

          {/* Right: Network Status + Account Pill */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Live Helius Devnet Status */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400"
              title="Connected to Helius Devnet RPC"
            >
              <Activity className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
              <span>Helius Devnet</span>
            </div>

            {/* Account / Wallet Trigger */}
            <button
              onClick={() => setIsModalOpen(true)}
              aria-label="Account and Wallet Settings"
              className="flex items-center gap-2.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-[#121428] hover:bg-[#191B36] border border-violet-500/30 text-white text-xs font-semibold transition group shadow-md"
            >
              <Wallet className="h-4 w-4 text-violet-400 group-hover:scale-110 transition" />
              {activeAddress ? (
                <>
                  <span className="font-mono text-slate-200">
                    {activeAddress.slice(0, 4)}...{activeAddress.slice(-4)}
                  </span>
                  {balance !== null && (
                    <span className="px-2 py-0.5 rounded-full bg-black/50 text-[11px] font-mono text-violet-300 border border-violet-500/20">
                      {balance.toFixed(2)} SOL
                    </span>
                  )}
                  <span
                    onClick={handleCopy}
                    className="p-1 rounded-full hover:bg-white/15 text-slate-400 hover:text-white transition"
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
                <span className="text-violet-200 font-bold">Connect Wallet</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        {onSelectTab && (
          <div className="flex md:hidden mt-2 max-w-7xl mx-auto rounded-full p-1 bg-[#0D0E1C]/90 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => onSelectTab("copilot")}
              className={`flex-1 py-1.5 rounded-full font-semibold transition ${
                activeTab === "copilot"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-400"
              }`}
            >
              Copilot &amp; Sentinel
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("scanner")}
              className={`flex-1 py-1.5 rounded-full font-semibold transition ${
                activeTab === "scanner"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-400"
              }`}
            >
              Token Safety Scanner
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
