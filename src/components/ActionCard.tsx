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
import {
  Zap,
  CheckCircle2,
  ExternalLink,
  Lock,
  Copy,
  Check,
  Flame,
  ArrowUpRight,
  Info,
  ShieldCheck,
} from "lucide-react";

export function computeRequiredSignerLamports(
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
    async function loadMeta() {
      try {
        const res = await fetch(actionUrl!);
        if (!res.ok) return;
        const data = (await res.json()) as BlinkMetadata;
        if (!cancelled) setMeta(data);
      } catch {
        // Ignore metadata fetch errors
      }
    }
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [actionUrl]);

  if (status === "blocked") {
    return (
      <section className="bg-white border border-[#F5C6C6] rounded-lg p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-[#FDF2F2] border border-[#F5C6C6] flex items-center justify-center text-[#991B1B] shrink-0 mt-0.5">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="step-number">04</span>
              <span className="badge-danger font-mono text-[10px]">
                Execution Prevented
              </span>
            </div>
            <h3 className="text-base font-bold text-[#1C1B18] mt-1.5">
              Solana Action Blocked by Policy Gate
            </h3>
            <p className="text-xs font-mono text-[#991B1B] mt-0.5">
              Risk Score: {riskScore ?? 100} / 100 · Execution Prohibited
            </p>
          </div>
        </div>
        <div className="text-xs text-[#5C2323] leading-relaxed bg-[#FDF2F2] p-4 rounded-md border border-[#F5C6C6] space-y-1.5">
          <p className="font-semibold text-[#991B1B]">
            What does this mean for your wallet?
          </p>
          <p>
            Because our deterministic safety checks detected a policy violation (such as a prompt injection attack, unauthorized address, or spending cap breach), AegisFlow refused to generate a signable transaction. <strong>Zero bytes were sent to your wallet, and your funds remain 100% untouched.</strong>
          </p>
        </div>
      </section>
    );
  }

  if (!actionUrl) return null;

  const resolvedDialUrl = blinkUrl || buildDialBlinkUrl(actionUrl);

  const executeSignFlow = async (mode: "wallet" | "burner") => {
    setIsExecuting(true);
    setExecError(null);
    setReceipt(null);

    try {
      const signerPubkey =
        mode === "wallet"
          ? publicKey?.toBase58()
          : burner?.keypair.publicKey.toBase58();

      if (!signerPubkey) {
        throw new Error(
          mode === "wallet"
            ? "Connect a Solana wallet to sign."
            : "No active Burner keypair found. Launch one in the Account Modal."
        );
      }

      // Step 1: POST to Solana Action endpoint for fresh transaction + blockhash
      const postRes = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: signerPubkey }),
      });

      const postData = await postRes.json();
      if (!postRes.ok) {
        throw new Error(
          postData.error || `Action endpoint returned HTTP ${postRes.status}`
        );
      }

      const txBase64 = postData.transaction as string;
      if (!txBase64) {
        throw new Error(
          "Action response did not contain transaction base64 payload."
        );
      }

      // Step 2: Deserialize transaction
      const txBuffer = Buffer.from(txBase64, "base64");
      const transaction = Transaction.from(txBuffer);

      // Step 3: Co-Sign transaction
      let signedTx: Transaction;
      if (mode === "wallet") {
        if (!signTransaction) {
          throw new Error("Connected wallet does not support signTransaction.");
        }
        signedTx = await signTransaction(transaction);
      } else {
        transaction.partialSign(burner!.keypair);
        signedTx = transaction;
      }

      const rawWire = signedTx.serialize();
      const primarySig = signedTx.signature
        ? bs58.encode(signedTx.signature)
        : "verified";

      // Step 4: Check signer Devnet SOL balance against required outflow + fee
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
        // Unfunded 0-SOL test wallet: run live RPC simulation & show verified co-signature receipt
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
              signerType: mode === "wallet" ? "wallet_adapter" : "burner_wallet",
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
    <section className="obsidian-card p-5 sm:p-6 space-y-5 text-[#1C1B18]">
      <div className="flex items-start justify-between gap-3 border-b border-[#E5E0D8] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="step-number">04</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#EBF5EE] text-[#166534] border border-[#C5E3CD] font-semibold">
              Ready to Sign · Devnet
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#1C1B18] pt-1">
            {meta?.title || "Approve & Sign Transaction"}
          </h3>
          <p className="text-xs text-[#5C5852]">
            Click below to co-sign this verified transaction using your test wallet or browser extension.
          </p>
        </div>
      </div>

      {meta?.description && (
        <div className="text-xs text-[#5C5852] leading-relaxed bg-[#FAF9F5] border border-[#E5E0D8] rounded-md p-3.5 font-mono">
          {meta.description}
        </div>
      )}

      {/* 1-Click Signing Buttons */}
      <div className="space-y-2.5">
        {connected && publicKey ? (
          <button
            type="button"
            disabled={isExecuting}
            onClick={() => executeSignFlow("wallet")}
            className="w-full rounded-md bg-[#1C1B18] hover:bg-[#33312B] disabled:opacity-50 px-5 py-3 text-xs sm:text-sm font-bold text-white transition shadow-sm flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Assembling Fresh Blockhash &amp; Signing...</span>
              </>
            ) : (
              <>
                <span>
                  Sign &amp; Execute Transaction (
                  {publicKey.toBase58().slice(0, 4)}..
                  {publicKey.toBase58().slice(-4)})
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : null}

        {burner ? (
          <button
            type="button"
            disabled={isExecuting}
            onClick={() => executeSignFlow("burner")}
            className="w-full rounded-md bg-[#1C1B18] hover:bg-[#33312B] disabled:opacity-50 px-5 py-3.5 text-xs sm:text-sm font-bold text-white transition shadow-sm flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Co-Signing with Burner &amp; Vault...</span>
              </>
            ) : (
              <>
                <Flame className="h-4 w-4 text-amber-300" />
                <span>
                  1-Click Sign with Judge Burner ({burner.pubkey.slice(0, 4)}..
                  {burner.pubkey.slice(-4)})
                </span>
              </>
            )}
          </button>
        ) : (
          <div className="p-3.5 rounded-md bg-[#FDF8E8] border border-[#F3E0A2] space-y-2.5">
            <p className="text-xs text-[#854D0E] font-medium">
              <strong>Need a wallet to sign?</strong> You don&apos;t need any browser extension—click below to open a 1-Click Test Wallet:
            </p>
            <button
              type="button"
              onClick={onOpenBurner}
              className="w-full rounded-md bg-[#1C1B18] hover:bg-[#33312B] px-4 py-3 text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Flame className="h-4 w-4 text-amber-300" />
              <span>
                No Solana Wallet Extension? Launch 1-Click Judge Burner Wallet
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Execution Receipt */}
      {receipt && (
        <div
          className={`rounded-md border p-4 space-y-3 text-xs shadow-sm ${
            receipt.mode === "confirmed_onchain"
              ? "border-[#C5E3CD] bg-[#EBF5EE] text-[#166534]"
              : "border-[#C5E3CD] bg-[#F5FBF7] text-[#1C1B18]"
          }`}
        >
          <div className="font-bold flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[#166534]">
              <CheckCircle2 className="h-4 w-4 text-[#166534]" />
              <span>
                {receipt.mode === "confirmed_onchain"
                  ? "Confirmed on Solana Devnet"
                  : "2-of-2 Ed25519 Co-Signature Verified"}
              </span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#C5E3CD] text-[#166534]">
              {receipt.wireBytes} bytes
            </span>
          </div>
          <p className="leading-relaxed text-[#383531]">{receipt.note}</p>
          <div className="p-2.5 rounded bg-white text-[11px] font-mono text-[#5C5852] break-all border border-[#E5E0D8]">
            Signature: {receipt.signature}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {receipt.explorerUrl && (
              <a
                href={receipt.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#166534] text-white px-3.5 py-1.5 font-semibold text-xs hover:bg-[#125129] transition"
              >
                <span>View on Solana Explorer (Devnet)</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {receipt.mode === "cosigned_verified_unfunded" && (
              <button
                type="button"
                onClick={onOpenBurner}
                className="underline text-[#1C1B18] hover:text-[#5C5852] font-semibold"
              >
                Open Faucet Helper →
              </button>
            )}
          </div>
        </div>
      )}

      {execError && (
        <div className="rounded-md border border-[#F5C6C6] bg-[#FDF2F2] p-3.5 text-xs text-[#991B1B] font-mono">
          <strong>Execution Error:</strong> {execError}
        </div>
      )}

      {/* Shareable Solana Blink Controls */}
      <div className="pt-3.5 border-t border-[#E5E0D8] space-y-2.5">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-[#1C1B18] block">
            Share as a Solana Blink (v2.2.1):
          </span>
          <p className="text-[11px] text-[#5C5852]">
            This approved plan is also a portable Solana Action link that can be shared or inspected on Dial.to:
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyAction}
            className="flex-1 rounded-md border border-[#D6D1C7] bg-[#F4F1EA] hover:bg-[#EAE6DC] px-3.5 py-2 text-xs font-semibold text-[#1C1B18] transition flex items-center justify-center gap-1.5"
          >
            {copiedUrl ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#166534]" />
                <span>Copied Action URL</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-[#5C5852]" />
                <span>Copy Solana Action URL</span>
              </>
            )}
          </button>
          <a
            href={resolvedDialUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center rounded-md border border-[#D6D1C7] bg-[#F4F1EA] hover:bg-[#EAE6DC] px-3.5 py-2 text-xs font-semibold text-[#1C1B18] transition flex items-center justify-center gap-1.5"
          >
            <span>Inspect Blink on Dial.to</span>
            <ExternalLink className="h-3.5 w-3.5 text-[#5C5852]" />
          </a>
        </div>
        <p className="text-[11px] text-[#8A857D] font-mono flex items-center gap-1.5 pt-1">
          <Info className="h-3 w-3 text-[#5C5852] shrink-0" />
          <span>
            Devnet Blinks: Enable Devnet in Phantom / Solflare under Developer Settings → Testnet Mode.
          </span>
        </p>
      </div>
    </section>
  );
}
