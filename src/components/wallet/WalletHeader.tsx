"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AccountModal } from "./AccountModal";
import {
  type BurnerWalletState,
  createBurnerWallet,
} from "@/lib/solana/burner";
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
  Compass,
  Flame,
} from "lucide-react";

export type AppTab = "guide" | "copilot" | "sentinel" | "scanner" | "docs";

export interface WalletHeaderProps {
  burner: BurnerWalletState | null;
  onSelectBurner: (burner: BurnerWalletState | null) => void;
  activeTab?: AppTab;
  onSelectTab?: (tab: AppTab) => void;
}

const NAV_ITEMS: Array<{
  id: AppTab;
  step: string;
  label: string;
  shortLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "guide",
    step: "01",
    label: "Start Here (Guide)",
    shortLabel: "01 · Guide",
    Icon: Compass,
  },
  {
    id: "copilot",
    step: "02",
    label: "AI Copilot",
    shortLabel: "02 · Copilot",
    Icon: Cpu,
  },
  {
    id: "sentinel",
    step: "03",
    label: "Safety Inspector",
    shortLabel: "03 · Safety",
    Icon: Shield,
  },
  {
    id: "scanner",
    step: "04",
    label: "Token Auditor",
    shortLabel: "04 · Auditor",
    Icon: Search,
  },
  {
    id: "docs",
    step: "05",
    label: "How It Works",
    shortLabel: "05 · Docs",
    Icon: FileText,
  },
];

export function WalletHeader({
  burner,
  onSelectBurner,
  activeTab = "guide",
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
          publicKey ||
            new (await import("@solana/web3.js")).PublicKey(activeAddress),
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

  const handleInstantBurner = () => {
    const fresh = createBurnerWallet();
    onSelectBurner(fresh);
  };

  if (!mounted) {
    return (
      <header className="w-full bg-[#FAF9F5] border-b border-[#E5E0D8] px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="h-7 w-32 bg-[#EAE6DC] rounded animate-pulse" />
          <div className="h-7 w-28 bg-[#EAE6DC] rounded animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="w-full bg-[#FAF9F5]/95 backdrop-blur-sm border-b border-[#E5E0D8] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          {/* Brand & Numbered Navigation */}
          <div className="flex items-center gap-5">
            <div
              className="flex items-center gap-2.5 cursor-pointer group shrink-0"
              onClick={() => onSelectTab?.("guide")}
            >
              <div className="h-8 w-8 rounded-md overflow-hidden shrink-0 border border-[#D6D1C7] shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aegis-icon.svg"
                  alt="AegisFlow Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-[#1C1B18]">
                    AegisFlow
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F4F1EA] text-[#5C5852] border border-[#E5E0D8]">
                    Devnet
                  </span>
                </div>
                <span className="text-[10px] text-[#8A857D] hidden sm:block leading-none">
                  Solana Safety Copilot
                </span>
              </div>
            </div>

            {/* Modular Desktop Navigation Tabs */}
            {onSelectTab && (
              <nav
                aria-label="Main Navigation"
                className="hidden lg:flex items-center gap-1 border-l border-[#E5E0D8] pl-4 text-xs"
              >
                {NAV_ITEMS.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectTab(item.id)}
                      className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? "bg-[#1C1B18] text-[#FAF9F5] font-semibold shadow-sm"
                          : "text-[#5C5852] hover:text-[#1C1B18] hover:bg-[#F4F1EA] font-medium"
                      }`}
                    >
                      <span
                        className={`font-mono text-[10px] px-1 py-0.2 rounded ${
                          isActive
                            ? "bg-white/15 text-[#FAF9F5]"
                            : "bg-[#EAE6DC] text-[#5C5852]"
                        }`}
                      >
                        {item.step}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right Wallet & Status Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Live RPC Status */}
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#F4F1EA] border border-[#E5E0D8] text-[11px] text-[#5C5852] font-medium"
              title="Connected to Solana Devnet RPC"
            >
              <Activity className="h-3 w-3 text-[#166534]" />
              <span>Devnet Active</span>
            </div>

            {/* If no wallet is active yet, provide an explicit 1-Click Test Wallet button */}
            {!activeAddress && (
              <button
                type="button"
                onClick={handleInstantBurner}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F4F1EA] hover:bg-[#EAE6DC] border border-[#D6D1C7] text-[#1C1B18] text-xs font-semibold transition"
                title="Create a temporary Devnet wallet in 1 click without any browser extension"
              >
                <Flame className="h-3.5 w-3.5 text-amber-700" />
                <span>1-Click Test Wallet</span>
              </button>
            )}

            {/* Account / Wallet Trigger */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              aria-label="Account and Wallet Settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1C1B18] hover:bg-[#33312B] text-[#FAF9F5] text-xs font-semibold transition shadow-sm"
            >
              <Wallet className="h-3.5 w-3.5" />
              {activeAddress ? (
                <>
                  <span className="text-[10px] uppercase tracking-wider text-[#CFC9BE] hidden sm:inline">
                    {connected ? "Wallet:" : "Test Wallet:"}
                  </span>
                  <span className="font-mono">
                    {activeAddress.slice(0, 4)}...{activeAddress.slice(-4)}
                  </span>
                  {balance !== null && (
                    <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-mono">
                      {balance.toFixed(2)} SOL
                    </span>
                  )}
                  <span
                    onClick={handleCopy}
                    className="p-0.5 rounded hover:bg-white/20 text-[#CFC9BE] hover:text-white transition"
                    title="Copy Your Wallet Address"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-300" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </span>
                </>
              ) : (
                <span>Wallet &amp; Faucet</span>
              )}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </div>
        </div>

        {/* Tablet / Mobile Navigation Bar */}
        {onSelectTab && (
          <div className="flex lg:hidden border-t border-[#E5E0D8] px-4 py-2 gap-1.5 bg-[#F4F1EA] overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition ${
                    isActive
                      ? "bg-[#1C1B18] text-[#FAF9F5] font-semibold"
                      : "text-[#5C5852] hover:text-[#1C1B18] bg-white/60 border border-[#E5E0D8]"
                  }`}
                >
                  {item.shortLabel}
                </button>
              );
            })}
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
