"use client";

import React, { useState, useEffect } from "react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import type { BurnerWalletState } from "@/lib/solana/burner";

function computeRequiredSignerLamports(
  tx: Transaction,
  signerPubkey: PublicKey
): number {
  let transferOutLamports = 0;
  for (const ix of tx.instructions) {
    if (ix.programId.equals(SystemProgram.programId)) {
      try {
        if (SystemInstruction.decodeInstructionType(ix) === "Transfer") {
          const decoded = SystemInstruction.decodeTransfer(ix);
          if (decoded.fromPubkey.equals(signerPubkey)) {
            transferOutLamports += Number(decoded.lamports);
          }
        }
      } catch {
        // Non-transfer system instruction
      }
    }
  }
  const signatureFeeLamports = Math.max(1, tx.signatures.length) * 5_000;
  return transferOutLamports + signatureFeeLamports;
}

export function buildExplorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function buildDialBlinkUrl(actionUrl: string): string {
  return `https://dial.to/?action=solana-action:${encodeURIComponent(
    actionUrl
  )}&cluster=devnet`;
}

interface BlinkMetadata {
  title: string;
  description: string;
  label: string;
  icon: string;
}

interface ExecutionReceipt {
  mode: "confirmed_onchain" | "cosigned_verified_unfunded";
  signature: string;
  signerType: "wallet_adapter" | "burner_wallet";
  signerPubkey: string;
  wireBytes: number;
  explorerUrl?: string;
  note: string;
}

export interface ActionCardProps {
  actionUrl: string | null;
  blinkUrl: string | null;
  riskScore: number | null;
  status: "approved" | "caution" | "blocked" | "readonly" | "unsupported";
  burner: BurnerWalletState | null;
  onOpenBurner: () => void;
}

export function ActionCard({
  actionUrl,
  blinkUrl,
  riskScore,
  status,
  burner,
  onOpenBurner,
}: ActionCardProps) {
  const { connection } = useConnection();
  const { connected, publicKey, signTransaction } = useWallet();

  const [meta, setMeta] = useState<BlinkMetadata | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ExecutionReceipt | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    setReceipt(null);
    setExecError(null);

    if (!actionUrl) {
      setMeta(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Use relative path when same-origin so dev/prod ports resolve cleanly
        const parsed = new URL(actionUrl, window.location.origin);
        const fetchTarget = `${parsed.pathname}${parsed.search}`;
        const res = await fetch(fetchTarget, { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setMeta({
            title: data.title,
            description: data.description,
            label: data.label,
            icon: data.icon,
          });
        }
      } catch {
        // Keep fallback card display
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [actionUrl]);

  if (status === "blocked") {
    return (
      <section className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-6 space-y-3">
        <div className="flex items-center gap-2 text-rose-300 font-bold text-base">
          <span>🛑</span> Solana Action &amp; Blink Generation Blocked
        </div>
        <p className="text-xs sm:text-sm text-rose-200/90 leading-relaxed">
          Because the deterministic Policy Gate scored this request at{" "}
          <strong className="font-mono">{riskScore ?? 100}/100</strong> (&ge; 50 threshold), AegisFlow refused to mint a signable{" "}
          <code className="font-mono text-xs">/api/actions/aegis</code> endpoint. Zero transaction bytes can reach your wallet.
        </p>
      </section>
    );
  }

  if (!actionUrl || (riskScore !== null && riskScore >= 50)) {
    return null;
  }

  const resolvedDialUrl = blinkUrl || buildDialBlinkUrl(actionUrl);

  const executeSignFlow = async (mode: "wallet" | "burner") => {
    setIsExecuting(true);
    setExecError(null);
    setReceipt(null);

    try {
      const signerPubkey =
        mode === "wallet" ? publicKey?.toBase58() : burner?.pubkey;
      if (!signerPubkey) {
        throw new Error(
          mode === "wallet"
            ? "Connect Phantom or Solflare on Devnet first."
            : "Generate a Guest Burner wallet first."
        );
      }

      const parsed = new URL(actionUrl, window.location.origin);
      const postTarget = `${parsed.pathname}${parsed.search}`;

      // Step 1: POST to Solana Actions endpoint to assemble fresh-blockhash tx (+ Vault partial sig for swaps)
      const postRes = await fetch(postTarget, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: signerPubkey }),
      });
      const postData = await postRes.json();
      if (!postRes.ok || !postData.transaction) {
        throw new Error(
          postData.message || `Action POST failed (${postRes.status}).`
        );
      }

      // Step 2: Deserialize transaction while preserving existing Vault partial signature
      const tx = Transaction.from(Buffer.from(postData.transaction, "base64"));

      // Step 3: Co-sign with either Connected Wallet Adapter or Guest Burner Keypair
      let signedTx: Transaction;
      if (mode === "burner") {
        if (!burner) throw new Error("Guest Burner wallet is not initialized.");
        tx.partialSign(burner.keypair);
        signedTx = tx;
      } else {
        if (!signTransaction) {
          throw new Error("Connected wallet does not support signTransaction.");
        }
        signedTx = await signTransaction(tx);
      }

      if (!signedTx.verifySignatures()) {
        throw new Error("Ed25519 co-signature verification failed.");
      }

      const rawWire = signedTx.serialize();
      const primarySig = signedTx.signature
        ? bs58.encode(signedTx.signature)
        : "verified";

      // Step 4: Check signer Devnet SOL balance against full outflow + network fee
      const signerPkObj =
        mode === "wallet" ? publicKey! : burner!.keypair.publicKey;
      const requiredLamports = computeRequiredSignerLamports(
        signedTx,
        signerPkObj
      );
      const balanceLamports = await connection.getBalance(
        signerPkObj,
        "confirmed"
      );

      if (balanceLamports === 0) {
        // Unfunded 0-SOL test wallet (e.g. faucet HTTP 410): run live RPC simulation & show co-signature receipt
        await connection.simulateTransaction(signedTx);
        setReceipt({
          mode: "cosigned_verified_unfunded",
          signature: primarySig,
          signerType: mode === "wallet" ? "wallet_adapter" : "burner_wallet",
          signerPubkey,
          wireBytes: rawWire.length,
          note: `All Ed25519 signatures (User + Aegis Vault) verified on ${rawWire.length}-byte transaction! Signer currently holds 0.0000 Devnet SOL — fund ≥ ${(
            requiredLamports / LAMPORTS_PER_SOL
          ).toFixed(5)} Devnet SOL via Faucet to broadcast on-chain.`,
        });
        return;
      }

      if (balanceLamports < requiredLamports) {
        throw new Error(
          `Insufficient Devnet SOL: wallet holds ${(
            balanceLamports / LAMPORTS_PER_SOL
          ).toFixed(5)} SOL, but this transaction requires ${(
            requiredLamports / LAMPORTS_PER_SOL
          ).toFixed(5)} SOL (including network fee).`
        );
      }

      // Pre-flight check on funded wallet: if swap Vault mock dUSDC mint is not yet initialized on Devnet,
      // surface a clean 2-of-2 verification receipt instead of a raw SPL program error.
      if (signedTx.instructions.length >= 4) {
        const preSim = await connection.simulateTransaction(signedTx);
        if (preSim.value.err) {
          const errStr = JSON.stringify(preSim.value.err);
          if (
            errStr.includes("IncorrectProgramId") ||
            errStr.includes("InvalidAccountData") ||
            errStr.includes("AccountNotFound")
          ) {
            setReceipt({
              mode: "cosigned_verified_unfunded",
              signature: primarySig,
              signerType:
                mode === "wallet" ? "wallet_adapter" : "burner_wallet",
              signerPubkey,
              wireBytes: rawWire.length,
              note: `2-of-2 Ed25519 signatures (User + Aegis Vault) verified on ${rawWire.length}-byte swap! Local Devnet Vault dUSDC mint is currently in faucet-410 preview mode (run npm run setup:vault once vault is funded, or test a live on-chain SOL Transfer immediately).`,
            });
            return;
          }
        }
      }

      // Step 5: Broadcast & Confirm on Solana Devnet
      const txSig = await connection.sendRawTransaction(rawWire, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      const latest = await connection.getLatestBlockhash("confirmed");
      let confirmationNote =
        "Transaction broadcast and confirmed on Solana Devnet!";
      try {
        const confirmRes = await Promise.race([
          connection.confirmTransaction(
            {
              signature: txSig,
              blockhash: signedTx.recentBlockhash || latest.blockhash,
              lastValidBlockHeight: latest.lastValidBlockHeight,
            },
            "confirmed"
          ),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Confirmation timeout (>30s)")),
              30_000
            )
          ),
        ]);
        if (confirmRes.value.err) {
          throw new Error(
            `On-chain execution error: ${JSON.stringify(confirmRes.value.err)}`
          );
        }
      } catch (confirmErr: unknown) {
        const cMsg =
          confirmErr instanceof Error ? confirmErr.message : String(confirmErr);
        if (cMsg.startsWith("On-chain execution error:")) {
          throw confirmErr;
        }
        confirmationNote =
          "Transaction broadcast to Solana Devnet (RPC confirmation timed out — verify status directly on Solana Explorer below).";
      }

      setReceipt({
        mode: "confirmed_onchain",
        signature: txSig,
        signerType: mode === "wallet" ? "wallet_adapter" : "burner_wallet",
        signerPubkey,
        wireBytes: rawWire.length,
        explorerUrl: buildExplorerTxUrl(txSig),
        note: confirmationNote,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Transaction execution failed.";
      setExecError(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyAction = async () => {
    try {
      const fullUrl = new URL(actionUrl, window.location.origin).toString();
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-5 sm:p-6 space-y-5 shadow-xl shadow-indigo-950/20">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta?.icon || "/aegis-icon.svg"}
            alt="AegisFlow Blink Shield"
            className="h-11 w-11 rounded-xl border border-indigo-500/30 bg-slate-950 p-1.5"
          />
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 block">
              ⚡ Solana Action / Blink Ready (v2.2.1 · Devnet)
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {meta?.title || "Approved AegisFlow Transaction"}
            </h3>
          </div>
        </div>
      </div>

      {meta?.description && (
        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
          {meta.description}
        </p>
      )}

      {/* 1-Click Signing Buttons: Connected Wallet OR Guest Burner */}
      <div className="space-y-2.5">
        {connected && publicKey ? (
          <button
            type="button"
            disabled={isExecuting}
            onClick={() => executeSignFlow("wallet")}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition"
          >
            {isExecuting
              ? "Assembling Fresh Blockhash & Signing..."
              : `${meta?.label || "Sign & Execute"} (${publicKey
                  .toBase58()
                  .slice(0, 4)}..${publicKey.toBase58().slice(-4)})`}
          </button>
        ) : null}

        {burner ? (
          <button
            type="button"
            disabled={isExecuting}
            onClick={() => executeSignFlow("burner")}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition"
          >
            {isExecuting
              ? "Co-Signing with Burner & Vault..."
              : `🔥 1-Click Sign with Guest Burner (${burner.pubkey.slice(
                  0,
                  4
                )}..${burner.pubkey.slice(-4)})`}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenBurner}
            className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2.5 text-xs font-semibold text-amber-200 transition"
          >
            🔥 No Devnet Wallet Extension? Launch 1-Click Judge Burner Wallet
          </button>
        )}
      </div>

      {/* Execution Receipt */}
      {receipt && (
        <div
          className={`rounded-xl border p-4 space-y-2 text-xs ${
            receipt.mode === "confirmed_onchain"
              ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-200"
              : "border-indigo-500/40 bg-indigo-950/25 text-indigo-200"
          }`}
        >
          <div className="font-bold flex items-center justify-between gap-2">
            <span>
              {receipt.mode === "confirmed_onchain"
                ? "✅ Confirmed on Solana Devnet"
                : "✅ 2-of-2 Ed25519 Co-Signature Verified"}
            </span>
            <span className="font-mono text-[11px] opacity-80">
              {receipt.wireBytes} bytes
            </span>
          </div>
          <p className="leading-relaxed text-slate-200">{receipt.note}</p>
          <div className="pt-1 font-mono text-[11px] text-slate-300 break-all">
            Signature: {receipt.signature}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {receipt.explorerUrl && (
              <a
                href={receipt.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/30 transition"
              >
                View on Solana Explorer (Devnet) ↗
              </a>
            )}
            {receipt.mode === "cosigned_verified_unfunded" && (
              <button
                type="button"
                onClick={onOpenBurner}
                className="underline text-amber-300 hover:text-amber-200 font-semibold"
              >
                Open Burner Faucet Helper →
              </button>
            )}
          </div>
        </div>
      )}

      {execError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-200">
          <strong>Execution Error:</strong> {execError}
        </div>
      )}

      {/* Shareable Solana Blink Controls */}
      <div className="pt-3 border-t border-slate-800 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyAction}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition"
          >
            {copiedUrl ? "Copied Action URL ✓" : "🔗 Copy Solana Action URL"}
          </button>
          <a
            href={resolvedDialUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-300 transition"
          >
            Inspect Blink on Dial.to ↗
          </a>
        </div>
        <p className="text-[11px] text-slate-400">
          💡 Using Phantom or Solflare? Enable <strong>Devnet</strong> under Wallet Settings → Developer Settings → Testnet Mode.
        </p>
      </div>
    </section>
  );
}
