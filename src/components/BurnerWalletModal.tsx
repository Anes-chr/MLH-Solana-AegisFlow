"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  type BurnerWalletState,
  createBurnerWallet,
  destroyBurnerWallet,
  importBurnerSecretKey,
} from "@/lib/solana/burner";

export interface BurnerWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  burner: BurnerWalletState | null;
  onBurnerChange: (next: BurnerWalletState | null) => void;
}

export function BurnerWalletModal({
  isOpen,
  onClose,
  burner,
  onBurnerChange,
}: BurnerWalletModalProps) {
  const { connection } = useConnection();
  const [balanceSol, setBalanceSol] = useState<number | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const [fundMessage, setFundMessage] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!burner) {
      setBalanceSol(null);
      return;
    }
    try {
      const lamports = await connection.getBalance(burner.keypair.publicKey, "confirmed");
      setBalanceSol(lamports / LAMPORTS_PER_SOL);
    } catch {
      setBalanceSol(0);
    }
  }, [burner, connection]);

  useEffect(() => {
    if (isOpen && burner) {
      refreshBalance();
    }
  }, [isOpen, burner, refreshBalance]);

  if (!isOpen) return null;

  const handleCreate = () => {
    const created = createBurnerWallet();
    onBurnerChange(created);
    setFundMessage("Generated fresh Ed25519 Devnet burner keypair in browser memory.");
    setExplorerUrl(null);
    setImportError(null);
  };

  const handleFund = async () => {
    if (!burner) return;
    setIsFunding(true);
    setFundMessage(null);
    setExplorerUrl(null);
    try {
      const res = await fetch("/api/burner-faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubkey: burner.pubkey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFundMessage(data.error || "Micro-funding request failed.");
      } else {
        setFundMessage(data.message || "Micro-funding check completed.");
        if (typeof data.balanceSol === "number") {
          setBalanceSol(data.balanceSol);
        }
        if (data.explorerUrl) {
          setExplorerUrl(data.explorerUrl);
        }
      }
    } catch {
      setFundMessage("Could not reach /api/burner-faucet. Burner remains active for signing.");
    } finally {
      setIsFunding(false);
    }
  };

  const handleCopy = async () => {
    if (!burner) return;
    try {
      await navigator.clipboard.writeText(burner.pubkey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in non-HTTPS iframe
    }
  };

  const handleImport = () => {
    setImportError(null);
    try {
      const imported = importBurnerSecretKey(secretInput);
      onBurnerChange(imported);
      setSecretInput("");
      setShowImport(false);
      setFundMessage("Imported Devnet keypair into ephemeral session.");
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Invalid secret key.");
    }
  };

  const handleBurn = () => {
    destroyBurnerWallet(burner?.keypair);
    onBurnerChange(null);
    setBalanceSol(null);
    setFundMessage("Secret key bytes overwritten with zeroes and removed from storage.");
    setExplorerUrl(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="burner-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="burner-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
              <span>🔥</span> 1-Click Judge / Guest Burner Wallet
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Test full Solana Action &amp; Blink co-signing in-browser without installing a wallet extension.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕ Close
          </button>
        </div>

        {/* Mandatory Devnet Safety Notice */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 leading-relaxed">
          <strong className="font-semibold text-amber-300">Devnet-only temporary wallet.</strong>{" "}
          Never send real Mainnet funds to this address. Keys live only in your browser tab and are wiped when burned.
        </div>

        {burner ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active Burner Public Key</span>
                <span className="text-emerald-400 font-medium">
                  {burner.persistedInStorage ? "Session Stored" : "RAM Only (Private Mode)"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-slate-200 break-all">
                  {burner.pubkey}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Devnet Balance:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-white">
                    {balanceSol !== null ? `${balanceSol.toFixed(4)} SOL` : "Checking..."}
                  </span>
                  <button
                    type="button"
                    onClick={refreshBalance}
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleFund}
                disabled={isFunding}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition"
              >
                {isFunding ? "Requesting Devnet SOL..." : "⚡ Micro-Fund 0.05 Devnet SOL"}
              </button>
              <button
                type="button"
                onClick={handleBurn}
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2.5 text-xs font-semibold text-rose-300 transition"
              >
                🗑️ Burn Wallet &amp; Zero Key
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleCreate}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition"
            >
              ⚡ Generate Instant Devnet Burner Wallet
            </button>
          </div>
        )}

        {/* Optional Keypair Import */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            {showImport ? "Hide Devnet Secret Key Import" : "Have a funded Devnet keypair? Import 64-byte JSON or Base58"}
          </button>

          {showImport && (
            <div className="mt-3 space-y-2">
              <textarea
                rows={2}
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="[12, 34, ...] (64 bytes) or base58 secret key"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs font-mono text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
              />
              {importError && (
                <p className="text-xs text-rose-400">{importError}</p>
              )}
              <button
                type="button"
                onClick={handleImport}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition"
              >
                Import Devnet Keypair
              </button>
            </div>
          )}
        </div>

        {fundMessage && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 text-xs text-slate-300 space-y-1.5">
            <p>{fundMessage}</p>
            <div className="flex flex-wrap items-center gap-3">
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-medium underline"
                >
                  View Funding Tx on Solana Explorer ↗
                </a>
              )}
              <a
                href="https://faucet.solana.com"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 font-medium underline"
              >
                Official Solana Devnet Faucet ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
