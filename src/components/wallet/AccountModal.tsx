"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  type BurnerWalletState,
  createBurnerWallet,
  importBurnerSecretKey,
  destroyBurnerWallet,
} from "@/lib/solana/burner";
import {
  Wallet,
  Shield,
  Copy,
  Check,
  ExternalLink,
  Flame,
  Key,
  RefreshCw,
  X,
  AlertCircle,
  Download,
  Sparkles,
} from "lucide-react";

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  burner: BurnerWalletState | null;
  onSelectBurner: (burner: BurnerWalletState | null) => void;
}

export function AccountModal({
  isOpen,
  onClose,
  burner,
  onSelectBurner,
}: AccountModalProps) {
  const { connection } = useConnection();
  const { connected, publicKey, wallet, select, wallets, disconnect } =
    useWallet();

  const [activeTab, setActiveTab] = useState<"wallet" | "burner" | "import">(
    "wallet"
  );
  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [importKey, setImportKey] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<string | null>(null);

  // Determine active displayed address
  const activeAddress =
    connected && publicKey
      ? publicKey.toBase58()
      : burner
      ? burner.pubkey
      : null;

  // Fetch balance for active address
  const fetchBalance = React.useCallback(
    async (addressStr: string) => {
      try {
        setIsRefreshingBalance(true);
        const pubkey = new PublicKey(addressStr);
        const lamports = await connection.getBalance(pubkey, "confirmed");
        setBalanceSol(lamports / LAMPORTS_PER_SOL);
      } catch {
        setBalanceSol(0);
      } finally {
        setIsRefreshingBalance(false);
      }
    },
    [connection]
  );

  useEffect(() => {
    if (activeAddress && isOpen) {
      fetchBalance(activeAddress);
    }
  }, [activeAddress, isOpen, fetchBalance]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCreateBurner = () => {
    const fresh = createBurnerWallet();
    onSelectBurner(fresh);
    fetchBalance(fresh.pubkey);
  };

  const handleWipeBurner = () => {
    destroyBurnerWallet(burner?.keypair);
    onSelectBurner(null);
    setBalanceSol(null);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    try {
      const imported = importBurnerSecretKey(importKey);
      onSelectBurner(imported);
      setImportKey("");
      setActiveTab("burner");
      fetchBalance(imported.pubkey);
    } catch (err: unknown) {
      setImportError(
        err instanceof Error ? err.message : "Failed to import secret key"
      );
    }
  };

  const handleRequestFaucet = async () => {
    if (!activeAddress) return;
    setFaucetLoading(true);
    setFaucetMessage(null);
    try {
      const res = await fetch("/api/burner-faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientPubkey: activeAddress, amountSol: 0.1 }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFaucetMessage(
          `Funded +0.1 SOL on Devnet! (Balance: ${data.confirmedBalanceSol} SOL)`
        );
        fetchBalance(activeAddress);
      } else {
        // Fallback guidance to official browser faucet
        await handleCopy(activeAddress);
        setFaucetMessage(
          "Address copied! Opening official Devnet Faucet (faucet.solana.com)..."
        );
        window.open(
          `https://faucet.solana.com/?recipient=${activeAddress}`,
          "_blank"
        );
      }
    } catch {
      await handleCopy(activeAddress);
      setFaucetMessage(
        "Address copied! Opening official Devnet Faucet (faucet.solana.com)..."
      );
      window.open(
        `https://faucet.solana.com/?recipient=${activeAddress}`,
        "_blank"
      );
    } finally {
      setFaucetLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl obsidian-card border border-violet-500/25 p-6 sm:p-7 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="icon-well shadow-inner">
              <Shield className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Account &amp; Devnet Wallet
              </h2>
              <p className="text-xs text-slate-400 font-normal">
                Connect browser wallet or launch an instant judge burner
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Account Modal"
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Active Account HUD (if connected or burner active) */}
        {activeAddress && (
          <div className="p-4 rounded-2xl bg-[#0C0D1B]/80 border border-violet-500/20 space-y-3 shadow-md">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                {connected ? "Connected Extension Wallet" : "Active Judge Burner"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-mono font-bold">
                  {balanceSol !== null ? `${balanceSol.toFixed(4)} SOL` : "—"}
                </span>
                <button
                  onClick={() => fetchBalance(activeAddress)}
                  disabled={isRefreshingBalance}
                  className="text-slate-400 hover:text-violet-400 transition"
                  title="Refresh Devnet Balance"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      isRefreshingBalance ? "animate-spin text-violet-400" : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-xs text-slate-200">
              <span className="truncate">{activeAddress}</span>
              <button
                onClick={() => handleCopy(activeAddress)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition text-[11px]"
              >
                {copiedAddress ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleRequestFaucet}
                disabled={faucetLoading}
                className="flex-1 py-2 px-3.5 rounded-full bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 border border-violet-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{faucetLoading ? "Funding..." : "Get Devnet SOL Faucet"}</span>
              </button>
              <a
                href={`https://explorer.solana.com/address/${activeAddress}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-medium flex items-center gap-1 transition"
              >
                <span>Explorer</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {faucetMessage && (
              <p className="text-[11px] text-violet-300 font-mono text-center">
                {faucetMessage}
              </p>
            )}
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-black/40 border border-white/5 text-xs font-medium">
          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex-1 py-2 rounded-full transition flex items-center justify-center gap-1.5 ${
              activeTab === "wallet"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Browser Wallet</span>
          </button>
          <button
            onClick={() => setActiveTab("burner")}
            className={`flex-1 py-2 rounded-full transition flex items-center justify-center gap-1.5 ${
              activeTab === "burner"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>Instant Judge Burner</span>
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 py-2 rounded-full transition flex items-center justify-center gap-1.5 ${
              activeTab === "import"
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Key className="h-3.5 w-3.5 text-indigo-400" />
            <span>Import Key</span>
          </button>
        </div>

        {/* Tab 1: Browser Extension Wallets */}
        {activeTab === "wallet" && (
          <div className="space-y-3">
            {connected ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-emerald-300 font-semibold">
                    Connected to {wallet?.adapter.name || "Solana Wallet"}
                  </span>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-medium transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Select an installed Solana wallet, or install one with 1 click:
                </p>
                {wallets.length > 0 ? (
                  wallets.map((w) => (
                    <button
                      key={w.adapter.name}
                      onClick={() => select(w.adapter.name)}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition text-xs font-semibold text-white"
                    >
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={w.adapter.icon}
                          alt={w.adapter.name}
                          className="h-5 w-5 rounded"
                        />
                        <span>{w.adapter.name}</span>
                      </div>
                      <span className="text-[11px] text-violet-400">Connect →</span>
                    </button>
                  ))
                ) : (
                  <div className="p-5 rounded-2xl bg-[#0C0D1B]/90 border border-white/10 space-y-3 text-center">
                    <AlertCircle className="h-6 w-6 text-amber-400 mx-auto" />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        No Solana browser wallet extension detected
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Judges don&apos;t need to install anything! Click the &quot;Instant
                        Judge Burner&quot; tab to test immediately without an extension.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <a
                        href="https://phantom.app/"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs text-slate-200 transition"
                      >
                        Install Phantom ↗
                      </a>
                      <a
                        href="https://solflare.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs text-slate-200 transition"
                      >
                        Install Solflare ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Instant Judge Burner Wallet */}
        {activeTab === "burner" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-amber-400" />
                Designed for Hackathon Judges &amp; Zero Friction
              </span>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Generates a genuine in-browser Solana Devnet keypair. Enables full
                simulation, atomic swaps, and 2-of-2 Ed25519 co-signing with zero
                extension downloads required.
              </p>
            </div>

            {burner ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">Burner Keypair</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Active
                    </span>
                  </div>
                  <p className="text-xs font-mono text-white truncate">
                    {burner.pubkey}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateBurner}
                    className="flex-1 py-2.5 px-3 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Generate Fresh Burner</span>
                  </button>
                  <button
                    onClick={handleWipeBurner}
                    className="py-2.5 px-4 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition"
                  >
                    Wipe Key
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleCreateBurner}
                className="btn-pill-primary w-full py-3.5 text-xs font-bold tracking-wide transition shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
              >
                <Flame className="h-4 w-4" />
                <span>Launch 1-Click Judge Devnet Wallet</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 3: Import Custom Keypair */}
        {activeTab === "import" && (
          <form onSubmit={handleImportSubmit} className="space-y-3">
            <p className="text-xs text-slate-400">
              Paste a base58 secret key or array to use your own pre-funded Devnet
              keypair (e.g. from <code>.devnet-keypair.json</code>):
            </p>
            <textarea
              rows={3}
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              placeholder="Paste base58 string or [12, 45, 23, ...] JSON array"
              className="w-full obsidian-input rounded-2xl p-3 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
            />
            {importError && (
              <p className="text-xs text-rose-400 font-mono">{importError}</p>
            )}
            <button
              type="submit"
              disabled={!importKey.trim()}
              className="btn-pill-primary w-full py-3 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Key className="h-4 w-4" />
              <span>Import &amp; Set Active</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
