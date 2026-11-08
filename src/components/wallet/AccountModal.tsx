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
  Info,
} from "lucide-react";

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  burner: BurnerWalletState | null;
  onSelectBurner: (burner: BurnerWalletState | null) => void;
}

const VAULT_PUBKEY_DISPLAY = "BRKVJTUZkfZg2SSNaPEyrekJm8UqGgsyqC1qQHKwSi35";

export function AccountModal({
  isOpen,
  onClose,
  burner,
  onSelectBurner,
}: AccountModalProps) {
  const { connection } = useConnection();
  const { connected, publicKey, wallet, select, wallets, disconnect } =
    useWallet();

  // Default to "burner" unless a browser extension wallet is actively connected
  const [activeTab, setActiveTab] = useState<"burner" | "wallet" | "import">(
    connected ? "wallet" : "burner"
  );
  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedVault, setCopiedVault] = useState(false);
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

  const handleCopyVault = async () => {
    try {
      await navigator.clipboard.writeText(VAULT_PUBKEY_DISPLAY);
      setCopiedVault(true);
      setTimeout(() => setCopiedVault(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCreateBurner = () => {
    const fresh = createBurnerWallet();
    onSelectBurner(fresh);
    setActiveTab("burner");
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
        body: JSON.stringify({
          pubkey: activeAddress,
          recipientPubkey: activeAddress,
          amountSol: 0.1,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.ok || data.funded)) {
        setFaucetMessage(
          `Funded Devnet SOL! (Balance: ${data.confirmedBalanceSol ?? data.balanceSol ?? "Funded"} SOL)`
        );
        fetchBalance(activeAddress);
      } else {
        await handleCopy(activeAddress);
        setFaucetMessage(
          "Your wallet address is copied! Paste it into faucet.solana.com to get free Devnet SOL."
        );
        window.open(
          `https://faucet.solana.com/?recipient=${activeAddress}`,
          "_blank"
        );
      }
    } catch {
      await handleCopy(activeAddress);
      setFaucetMessage(
        "Your wallet address is copied! Paste it into faucet.solana.com to get free Devnet SOL."
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1B18]/45 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-xl bg-white border border-[#E5E0D8] p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#F4F1EA] border border-[#E5E0D8] flex items-center justify-center text-[#1C1B18]">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1C1B18]">
                Wallet &amp; Test Account Setup
              </h2>
              <p className="text-xs text-[#5C5852]">
                Use a 1-click in-browser test wallet (no extension needed) or connect Phantom / Solflare
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Account Modal"
            className="p-1.5 rounded-md text-[#5C5852] hover:text-[#1C1B18] hover:bg-[#F4F1EA] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active Account Box */}
        {activeAddress ? (
          <div className="p-4 rounded-lg bg-[#F4F1EA] border border-[#E5E0D8] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm bg-[#166534]" />
                <span className="text-[#1C1B18] font-bold">
                  {connected
                    ? `Your Connected Wallet (${wallet?.adapter.name})`
                    : "Your Active Test Wallet (Judge Burner)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#1C1B18] font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#E5E0D8]">
                  {balanceSol !== null ? `${balanceSol.toFixed(4)} SOL` : "0.0000 SOL"}
                </span>
                <button
                  onClick={() => fetchBalance(activeAddress)}
                  disabled={isRefreshingBalance}
                  className="p-1 rounded bg-white border border-[#E5E0D8] text-[#5C5852] hover:text-[#1C1B18] transition"
                  title="Refresh Devnet Balance"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${
                      isRefreshingBalance ? "animate-spin text-[#1C1B18]" : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-[#5C5852] block">
                Your Public Solana Address (use this to receive Devnet SOL):
              </span>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-white border border-[#D6D1C7] font-mono text-xs text-[#1C1B18]">
                <span className="truncate select-all">{activeAddress}</span>
                <button
                  onClick={() => handleCopy(activeAddress)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1C1B18] hover:bg-[#33312B] text-white transition text-[11px] font-sans font-semibold shrink-0"
                >
                  {copiedAddress ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Address</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleRequestFaucet}
                disabled={faucetLoading}
                className="flex-1 py-2 px-3 rounded-md bg-white hover:bg-[#EAE6DC] text-[#1C1B18] border border-[#D6D1C7] text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>
                  {faucetLoading
                    ? "Requesting Devnet SOL..."
                    : "Fund Wallet with Free Devnet SOL"}
                </span>
              </button>
              <a
                href={`https://explorer.solana.com/address/${activeAddress}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-md bg-white hover:bg-[#EAE6DC] text-[#1C1B18] border border-[#D6D1C7] text-xs font-medium flex items-center gap-1.5 transition"
              >
                <span>View on Explorer</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {faucetMessage && (
              <p className="text-xs text-[#166534] bg-[#EBF5EE] border border-[#C5E3CD] p-2.5 rounded-md font-medium">
                {faucetMessage}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#FDF8E8] border border-[#F3E0A2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#854D0E] block">
                No Active Wallet Yet
              </span>
              <p className="text-xs text-[#5C5852]">
                Create a free 1-click test wallet right now to test swaps and signing.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateBurner}
              className="btn-editorial-primary shrink-0 text-xs"
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Create 1-Click Test Wallet</span>
            </button>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex items-center gap-1 p-1 rounded-md bg-[#F4F1EA] border border-[#E5E0D8] text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("burner")}
            className={`flex-1 py-2 rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "burner"
                ? "bg-white text-[#1C1B18] shadow-sm font-bold border border-[#E5E0D8]"
                : "text-[#5C5852] hover:text-[#1C1B18]"
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-amber-700" />
            <span>Instant Judge Burner</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("wallet")}
            className={`flex-1 py-2 rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "wallet"
                ? "bg-white text-[#1C1B18] shadow-sm font-bold border border-[#E5E0D8]"
                : "text-[#5C5852] hover:text-[#1C1B18]"
            }`}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Browser Extension</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`flex-1 py-2 rounded transition flex items-center justify-center gap-1.5 ${
              activeTab === "import"
                ? "bg-white text-[#1C1B18] shadow-sm font-bold border border-[#E5E0D8]"
                : "text-[#5C5852] hover:text-[#1C1B18]"
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            <span>Import Key</span>
          </button>
        </div>

        {/* Tab 1: Instant Judge Burner Wallet */}
        {activeTab === "burner" && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-md bg-[#FAF9F5] border border-[#E5E0D8] text-xs text-[#1C1B18] space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-amber-700" />
                Recommended for Hackathon Judges &amp; Beginners
              </span>
              <p className="text-xs text-[#5C5852] leading-relaxed">
                Generates a real Solana Devnet keypair stored temporarily in your browser. You can simulate swaps, verify 2-of-2 signatures, and broadcast transactions without installing Phantom or Solflare.
              </p>
            </div>

            {burner ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateBurner}
                  className="flex-1 py-2.5 px-3 rounded-md bg-[#F4F1EA] hover:bg-[#EAE6DC] text-xs font-semibold text-[#1C1B18] border border-[#E5E0D8] transition flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Generate Fresh Burner</span>
                </button>
                <button
                  type="button"
                  onClick={handleWipeBurner}
                  className="py-2.5 px-4 rounded-md bg-[#FDF2F2] hover:bg-[#FBE4E4] text-[#991B1B] border border-[#F5C6C6] text-xs font-semibold transition"
                >
                  Wipe Key
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCreateBurner}
                className="btn-editorial-primary w-full py-3 text-xs font-bold tracking-wide transition flex items-center justify-center gap-2"
              >
                <Flame className="h-4 w-4" />
                <span>Launch 1-Click Judge Devnet Wallet</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 2: Browser Extension Wallets */}
        {activeTab === "wallet" && (
          <div className="space-y-3">
            {connected ? (
              <div className="p-3.5 rounded-lg bg-[#EBF5EE] border border-[#C5E3CD] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-sm bg-[#166534]" />
                  <span className="text-xs text-[#166534] font-semibold">
                    Connected to {wallet?.adapter.name || "Solana Wallet"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="px-3 py-1 rounded-md bg-white hover:bg-rose-50 text-[#5C5852] hover:text-rose-700 text-xs font-medium border border-[#E5E0D8] transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {wallets.length > 0 ? (
                  <>
                    <p className="text-xs text-[#5C5852]">
                      Click your installed Solana browser extension below:
                    </p>
                    {wallets.map((w) => (
                      <button
                        type="button"
                        key={w.adapter.name}
                        onClick={() => select(w.adapter.name)}
                        className="w-full flex items-center justify-between p-3 rounded-md bg-white hover:bg-[#FAF9F5] border border-[#E5E0D8] transition text-xs font-semibold text-[#1C1B18]"
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
                        <span className="text-[11px] text-[#5C5852]">Connect →</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="p-4 rounded-md bg-[#FAF9F5] border border-[#E5E0D8] space-y-3 text-center">
                    <AlertCircle className="h-5 w-5 text-amber-700 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#1C1B18]">
                        No Browser Wallet Extension Detected
                      </p>
                      <p className="text-xs text-[#5C5852] max-w-md mx-auto">
                        You don&apos;t have Phantom or Solflare installed in this browser. Click below to use the built-in 1-Click Test Wallet instead!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateBurner}
                      className="btn-editorial-primary w-full py-2.5 text-xs font-bold"
                    >
                      <Flame className="h-4 w-4" />
                      <span>Use 1-Click Judge Test Wallet Instead</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Import Custom Keypair */}
        {activeTab === "import" && (
          <form onSubmit={handleImportSubmit} className="space-y-3">
            <p className="text-xs text-[#5C5852]">
              Paste a base58 secret key or JSON byte array to use your own pre-funded Devnet keypair:
            </p>
            <textarea
              rows={3}
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              placeholder="Paste base58 string or [12, 45, 23, ...] JSON array"
              className="w-full obsidian-input rounded-md p-2.5 text-xs font-mono text-[#1C1B18] placeholder-[#8A857D] focus:outline-none"
            />
            {importError && (
              <p className="text-xs text-rose-700 font-mono">{importError}</p>
            )}
            <button
              type="submit"
              disabled={!importKey.trim()}
              className="btn-editorial-primary w-full py-2.5 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Key className="h-3.5 w-3.5" />
              <span>Import &amp; Set Active</span>
            </button>
          </form>
        )}

        {/* Clear Explanation of Protocol Vault vs User Wallet */}
        <div className="pt-3 border-t border-[#E5E0D8] space-y-2">
          <div className="flex items-start gap-2 text-[11px] text-[#5C5852]">
            <Info className="h-3.5 w-3.5 text-[#1C1B18] shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1 min-w-0">
              <span className="font-semibold text-[#1C1B18] block">
                Protocol Liquidity Vault vs. Your Wallet:
              </span>
              <p className="leading-relaxed">
                The address above is <strong>your personal test wallet</strong>. When you swap SOL for USDC, your wallet trades against AegisFlow&apos;s Devnet Liquidity Vault:
              </p>
              <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-[#FAF9F5] border border-[#E5E0D8] font-mono text-[10px] text-[#5C5852]">
                <span className="truncate">Vault: {VAULT_PUBKEY_DISPLAY}</span>
                <button
                  type="button"
                  onClick={handleCopyVault}
                  className="px-2 py-0.5 rounded bg-white border border-[#E5E0D8] text-[#1C1B18] hover:bg-[#F4F1EA] shrink-0 font-sans font-medium"
                >
                  {copiedVault ? "Copied" : "Copy Vault"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
