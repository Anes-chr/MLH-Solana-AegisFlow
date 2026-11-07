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
      <header className="w-full border-b border-white/5 bg-[#07090E]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="h-9 w-32 bg-white/5 rounded-lg animate-pulse" />
        <div className="h-9 w-40 bg-white/5 rounded-lg animate-pulse" />
      </header>
    );
  }

  return (
    <>
      <header className="w-full border-b border-white/10 bg-[#07090E]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
          {/* Left: Brand Emblem + Wordmark */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab?.("copilot")}>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500/20 via-indigo-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center shadow-inner">
                <svg className="h-5 w-5" viewBox="0 0 32 32" fill="none">
                  <path d="M16 4L6 8V15C6 21.6 10.3 27.6 16 29C21.7 27.6 26 21.6 26 15V8L16 4Z" stroke="#06B6D4" stroke-width="2" stroke-linejoin="round"/>
                  <path d="M11 16L15 20L21 12" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base tracking-tight text-white">
                    AegisFlow
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    DEVNET
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block -mt-0.5 font-mono">
                  Autonomous DeFi Guardrails
                </span>
              </div>
            </div>

            {/* Desktop Tabs */}
            {onSelectTab && (
              <nav className="hidden md:flex items-center gap-1 rounded-xl bg-black/40 p-1 border border-white/5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => onSelectTab("copilot")}
                  className={`px-3.5 py-1.5 rounded-lg transition ${
                    activeTab === "copilot"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Copilot &amp; Sentinel
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab("scanner")}
                  className={`px-3.5 py-1.5 rounded-lg transition ${
                    activeTab === "scanner"
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Token Safety Scanner
                </button>
              </nav>
            )}
          </div>

          {/* Right: Network Status + Account Pill */}
          <div className="flex items-center gap-3">
            {/* Live Helius Devnet Status */}
            <div
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-medium text-emerald-400"
              title="Connected to Helius Devnet RPC"
            >
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              <span>Helius Devnet</span>
            </div>

            {/* Account / Wallet Trigger */}
            <button
              onClick={() => setIsModalOpen(true)}
              aria-label="Account and Wallet Settings"
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition group shadow-sm"
            >
              <Wallet className="h-4 w-4 text-cyan-400 group-hover:scale-105 transition" />
              {activeAddress ? (
                <>
                  <span className="font-mono text-slate-200">
                    {activeAddress.slice(0, 4)}...{activeAddress.slice(-4)}
                  </span>
                  {balance !== null && (
                    <span className="px-1.5 py-0.5 rounded bg-black/40 text-[11px] font-mono text-cyan-300 border border-white/5">
                      {balance.toFixed(2)} SOL
                    </span>
                  )}
                  <span
                    onClick={handleCopy}
                    className="p-1 rounded hover:bg-white/15 text-slate-400 hover:text-white transition"
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
                <span className="text-cyan-300 font-bold">Connect Wallet</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Switcher */}
        {onSelectTab && (
          <div className="flex md:hidden border-t border-white/5 px-4 py-2 gap-2 bg-black/40">
            <button
              type="button"
              onClick={() => onSelectTab("copilot")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "copilot"
                  ? "bg-white/10 text-white"
                  : "text-slate-400"
              }`}
            >
              Copilot &amp; Sentinel
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("scanner")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "scanner"
                  ? "bg-white/10 text-white"
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
