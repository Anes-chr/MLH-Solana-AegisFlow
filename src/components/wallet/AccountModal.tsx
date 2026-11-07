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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B1A]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-xl bg-white border border-[#E7E4DC] p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E4DC] pb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#F3F1EC] border border-[#E7E4DC] flex items-center justify-center text-[#1C1B1A]">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1C1B1A]">
                Account &amp; Devnet Wallet
              </h2>
              <p className="text-xs text-[#66635D]">
                Connect browser wallet or launch an instant judge burner
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Account Modal"
            className="p-1.5 rounded-md text-[#66635D] hover:text-[#1C1B1A] hover:bg-[#F3F1EC] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active Account HUD */}
        {activeAddress && (
          <div className="p-3.5 rounded-lg bg-[#F8F7F4] border border-[#E7E4DC] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#66635D] font-medium">
                {connected ? "Connected Extension Wallet" : "Active Judge Burner"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[#1C1B1A] font-mono font-bold">
                  {balanceSol !== null ? `${balanceSol.toFixed(4)} SOL` : "—"}
                </span>
                <button
                  onClick={() => fetchBalance(activeAddress)}
                  disabled={isRefreshingBalance}
                  className="text-[#66635D] hover:text-[#1C1B1A] transition"
                  title="Refresh Devnet Balance"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${
                      isRefreshingBalance ? "animate-spin text-[#1C1B1A]" : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-white border border-[#E7E4DC] font-mono text-xs text-[#1C1B1A]">
              <span className="truncate">{activeAddress}</span>
              <button
                onClick={() => handleCopy(activeAddress)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#F3F1EC] hover:bg-[#EBE8E1] text-[#1C1B1A] border border-[#E7E4DC] transition text-[11px]"
              >
                {copiedAddress ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-[#66635D]" />
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
                className="flex-1 py-1.5 px-3 rounded-md bg-[#F3F1EC] hover:bg-[#EBE8E1] text-[#1C1B1A] border border-[#E7E4DC] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Download className="h-3 w-3" />
                <span>{faucetLoading ? "Funding..." : "Get Devnet SOL Faucet"}</span>
              </button>
              <a
                href={`https://explorer.solana.com/address/${activeAddress}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3 rounded-md bg-white hover:bg-[#F3F1EC] text-[#1C1B1A] border border-[#E7E4DC] text-xs font-medium flex items-center gap-1 transition"
              >
                <span>Explorer</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {faucetMessage && (
              <p className="text-[11px] text-[#4A4742] font-mono text-center">
                {faucetMessage}
              </p>
            )}
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex items-center gap-1 p-1 rounded-md bg-[#F3F1EC] border border-[#E7E4DC] text-xs font-medium">
          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex-1 py-1.5 rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "wallet"
                ? "bg-white text-[#1C1B1A] shadow-sm font-semibold border border-[#E7E4DC]"
                : "text-[#66635D] hover:text-[#1C1B1A]"
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Browser Wallet</span>
          </button>
          <button
            onClick={() => setActiveTab("burner")}
            className={`flex-1 py-1.5 rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "burner"
                ? "bg-white text-[#1C1B1A] shadow-sm font-semibold border border-[#E7E4DC]"
                : "text-[#66635D] hover:text-[#1C1B1A]"
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-amber-600" />
            <span>Instant Judge Burner</span>
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 py-1.5 rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "import"
                ? "bg-white text-[#1C1B1A] shadow-sm font-semibold border border-[#E7E4DC]"
                : "text-[#66635D] hover:text-[#1C1B1A]"
            }`}
          >
            <Key className="h-3.5 w-3.5 text-slate-600" />
            <span>Import Key</span>
          </button>
        </div>

        {/* Tab 1: Browser Extension Wallets */}
        {activeTab === "wallet" && (
          <div className="space-y-3">
            {connected ? (
              <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span className="text-xs text-emerald-800 font-semibold">
                    Connected to {wallet?.adapter.name || "Solana Wallet"}
                  </span>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="px-3 py-1 rounded-md bg-white hover:bg-rose-50 text-[#66635D] hover:text-rose-700 text-xs font-medium border border-[#E7E4DC] transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[#66635D]">
                  Select an installed Solana wallet, or install one:
                </p>
                {wallets.length > 0 ? (
                  wallets.map((w) => (
                    <button
                      key={w.adapter.name}
                      onClick={() => select(w.adapter.name)}
                      className="w-full flex items-center justify-between p-2.5 rounded-md bg-white hover:bg-[#F8F7F4] border border-[#E7E4DC] transition text-xs font-semibold text-[#1C1B1A]"
                    >
                      <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={w.adapter.icon}
                          alt={w.adapter.name}
                          className="h-4 w-4 rounded"
                        />
                        <span>{w.adapter.name}</span>
                      </div>
                      <span className="text-[11px] text-[#66635D]">Connect →</span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 rounded-md bg-[#F8F7F4] border border-[#E7E4DC] space-y-2.5 text-center">
                    <AlertCircle className="h-5 w-5 text-amber-600 mx-auto" />
                    <div>
                      <p className="text-xs font-semibold text-[#1C1B1A]">
                        No Solana browser wallet extension detected
                      </p>
                      <p className="text-[11px] text-[#66635D] mt-1">
                        Judges don&apos;t need to install anything! Click the &quot;Instant
                        Judge Burner&quot; tab to test immediately without an extension.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <a
                        href="https://phantom.app/"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-md bg-white hover:bg-[#F3F1EC] text-xs text-[#1C1B1A] border border-[#E7E4DC] transition"
                      >
                        Install Phantom ↗
                      </a>
                      <a
                        href="https://solflare.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-md bg-white hover:bg-[#F3F1EC] text-xs text-[#1C1B1A] border border-[#E7E4DC] transition"
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
          <div className="space-y-3.5">
            <div className="p-3 rounded-md bg-[#FEFCE8] border border-[#FEF08A] text-xs text-[#854D0E] space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-amber-600" />
                Designed for Hackathon Judges &amp; Zero Friction
              </span>
              <p className="text-[11px] text-[#A16207] leading-relaxed">
                Generates a genuine in-browser Solana Devnet keypair. Enables full
                simulation, atomic swaps, and 2-of-2 Ed25519 co-signing with zero
                extension downloads required.
              </p>
            </div>

            {burner ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded-md bg-[#F8F7F4] border border-[#E7E4DC] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#66635D] font-mono">Burner Keypair</span>
                    <span className="text-[10px] text-emerald-700 font-mono font-bold">
                      Active
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#1C1B1A] truncate">
                    {burner.pubkey}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateBurner}
                    className="flex-1 py-2 px-3 rounded-md bg-[#F3F1EC] hover:bg-[#EBE8E1] text-xs font-semibold text-[#1C1B1A] border border-[#E7E4DC] transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Generate Fresh Burner</span>
                  </button>
                  <button
                    onClick={handleWipeBurner}
                    className="py-2 px-3.5 rounded-md bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] text-xs font-semibold transition"
                  >
                    Wipe Key
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleCreateBurner}
                className="btn-editorial-primary w-full py-2.5 text-xs font-bold tracking-wide transition flex items-center justify-center gap-2"
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
            <p className="text-xs text-[#66635D]">
              Paste a base58 secret key or array to use your own pre-funded Devnet
              keypair (e.g. from <code>.devnet-keypair.json</code>):
            </p>
            <textarea
              rows={3}
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              placeholder="Paste base58 string or [12, 45, 23, ...] JSON array"
              className="w-full obsidian-input rounded-md p-2.5 text-xs font-mono text-[#1C1B1A] placeholder-[#9E9A92] focus:outline-none"
            />
            {importError && (
              <p className="text-xs text-rose-700 font-mono">{importError}</p>
            )}
            <button
              type="submit"
              disabled={!importKey.trim()}
              className="btn-editorial-primary w-full py-2 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Key className="h-3.5 w-3.5" />
              <span>Import &amp; Set Active</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
