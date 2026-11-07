"use client";

import React, { useState, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

export interface WalletHeaderProps {
  burnerPubkey?: string | null;
  onOpenBurner?: () => void;
  activeTab?: "copilot" | "scanner";
  onSelectTab?: (tab: "copilot" | "scanner") => void;
}

export function WalletHeader({
  burnerPubkey,
  onOpenBurner,
  activeTab = "copilot",
  onSelectTab,
}: WalletHeaderProps = {}) {
  const [mounted, setMounted] = useState(false);
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <header className="w-full flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600/30 animate-pulse" />
          <div>
            <div className="h-5 w-24 bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-28 bg-slate-800 rounded mt-1 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-28 rounded-full bg-slate-800 animate-pulse" />
          <div className="h-10 w-32 rounded-xl bg-slate-800 animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-500 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/30 text-base">
              🛡️
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">
                AegisFlow
              </span>
              <span className="text-[11px] text-slate-400 block -mt-1 font-mono">
                Pre-Flight Guardrails &amp; Blinks
              </span>
            </div>
          </div>

          {onSelectTab && (
            <nav className="hidden md:flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => onSelectTab("copilot")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === "copilot"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Copilot &amp; Sentinel
              </button>
              <button
                type="button"
                onClick={() => onSelectTab("scanner")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === "scanner"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Token Safety Scanner
              </button>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Network Status Badge */}
          <div
            className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400"
            title={`Connected Network: Solana Devnet (${connection.rpcEndpoint})`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">Solana</span>
            <span>Devnet</span>
          </div>

          {/* Guest Burner Wallet Trigger */}
          {onOpenBurner && (
            <button
              type="button"
              onClick={onOpenBurner}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition flex items-center gap-1.5 ${
                burnerPubkey
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600"
              }`}
              title="1-Click Ephemeral Devnet Burner Wallet for Judges"
            >
              <span>🔥</span>
              <span className="hidden sm:inline">
                {burnerPubkey
                  ? `Burner ${burnerPubkey.slice(0, 4)}..${burnerPubkey.slice(-4)}`
                  : "Guest Burner"}
              </span>
            </button>
          )}

          {/* Connected Wallet Summary */}
          {connected && publicKey && (
            <span className="text-xs text-slate-400 font-mono hidden lg:inline px-2 py-1 rounded bg-slate-900 border border-slate-800">
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          )}

          {/* Wallet Adapter Multi Button */}
          <div className="wallet-adapter-wrapper">
            <WalletMultiButton className="!bg-gradient-to-r !from-indigo-600 !to-violet-600 hover:!from-indigo-500 hover:!to-violet-500 !rounded-xl !h-9 sm:!h-10 !px-3 sm:!px-4 !text-xs sm:!text-sm !font-semibold !transition-all !shadow-lg !shadow-indigo-500/25" />
          </div>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      {onSelectTab && (
        <div className="flex md:hidden border-t border-slate-800/80 px-4 py-2 gap-2 bg-slate-950">
          <button
            type="button"
            onClick={() => onSelectTab("copilot")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "copilot"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400"
            }`}
          >
            Copilot &amp; Sentinel
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("scanner")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "scanner"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400"
            }`}
          >
            Token Safety Scanner
          </button>
        </div>
      )}
    </header>
  );
}
