"use client";

import React, { useState } from "react";
import type { TokenScanReport } from "@/lib/solana/scanner";
import {
  Search,
  Sliders,
  Check,
  X,
  Info,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

const PRESET_MINTS = [
  {
    id: "wsol",
    stepTag: "SAMPLE 01 · SAFE BENCHMARK",
    label: "Wrapped SOL (Revoked / Safe)",
    expectedBadge: "SAFE · 0/100",
    tone: "emerald" as const,
    summary:
      "Both Mint and Freeze authorities are permanently revoked. Nobody can print extra supply or freeze your balance.",
    mint: "So11111111111111111111111111111111111111112",
    cluster: "mainnet-beta" as const,
  },
  {
    id: "usdc",
    stepTag: "SAMPLE 02 · FREEZE AUTHORITY",
    label: "Mainnet USDC (Freeze Auth Active)",
    expectedBadge: "CAUTION",
    tone: "amber" as const,
    summary:
      "Standard SPL token where the issuer retains an active Freeze Authority capable of freezing individual token accounts.",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    cluster: "mainnet-beta" as const,
  },
  {
    id: "pyusd",
    stepTag: "SAMPLE 03 · TOKEN-2022 EXTENSIONS",
    label: "PayPal USD (Token-2022 PermanentDelegate)",
    expectedBadge: "DANGER · TLV",
    tone: "rose" as const,
    summary:
      "Uses Solana Token-2022 binary extensions including PermanentDelegate (issuer can transfer/burn tokens from any account).",
    mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    cluster: "mainnet-beta" as const,
  },
  {
    id: "devnet-usdc",
    stepTag: "SAMPLE 04 · DEVNET TEST TOKEN",
    label: "Devnet USDC",
    expectedBadge: "DEVNET",
    tone: "slate" as const,
    summary:
      "Inspects a live Solana Devnet test token mint to demonstrate cross-cluster automatic RPC detection.",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    cluster: "devnet" as const,
  },
];

export function TokenScanner() {
  const [mintInput, setMintInput] = useState(PRESET_MINTS[2].mint);
  const [cluster, setCluster] = useState<"auto" | "mainnet-beta" | "devnet">(
    "auto"
  );
  const [isScanning, setIsScanning] = useState(false);
  const [report, setReport] = useState<TokenScanReport | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const runScan = async (
    targetMint: string,
    targetCluster: "auto" | "mainnet-beta" | "devnet" = cluster
  ) => {
    const trimmed = targetMint.trim();
    if (!trimmed) return;
    setIsScanning(true);
    setScanError(null);

    try {
      const qs = new URLSearchParams({ mint: trimmed });
      if (targetCluster !== "auto") {
        qs.set("cluster", targetCluster);
      }
      const res = await fetch(`/api/scanner?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || `Scanner returned HTTP ${res.status}`);
        setReport(null);
      } else {
        setReport(data as TokenScanReport);
      }
    } catch {
      setScanError("Network error while querying /api/scanner.");
      setReport(null);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <section className="obsidian-card p-5 sm:p-7 space-y-6 text-[#1C1B18]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E0D8] pb-5">
        <div className="flex items-start gap-3.5">
          <div className="step-number mt-0.5">01</div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1C1B18] tracking-tight">
              Token Security &amp; Rug-Pull Auditor (SPL + Token-2022)
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5852] mt-1 leading-relaxed">
              Before buying or swapping an unfamiliar token on Solana, check its on-chain Mint account to see if the creator can print infinite tokens, freeze your wallet, or claw back funds.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#F4F1EA] px-3.5 py-2 rounded-md border border-[#E5E0D8] shrink-0 self-start sm:self-auto">
          <Sliders className="h-3.5 w-3.5 text-[#5C5852]" />
          <span className="text-xs font-semibold text-[#1C1B18]">Network:</span>
          <select
            aria-label="Solana cluster selector"
            value={cluster}
            onChange={(e) =>
              setCluster(e.target.value as "auto" | "mainnet-beta" | "devnet")
            }
            className="bg-white px-2 py-0.5 rounded border border-[#D6D1C7] text-xs font-mono font-bold text-[#1C1B18] outline-none cursor-pointer"
          >
            <option value="auto">Auto-Detect</option>
            <option value="mainnet-beta">Mainnet-Beta</option>
            <option value="devnet">Devnet</option>
          </select>
        </div>
      </div>

      {/* Beginner Explainer Box */}
      <div className="editorial-callout p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <span className="font-bold text-[#1C1B18] block">
            1. What is Mint Authority?
          </span>
          <p className="text-[#5C5852] leading-relaxed">
            If active, the token creator can print unlimited new tokens at any time, diluting holders. <strong>Revoked = Safe.</strong>
          </p>
        </div>
        <div className="space-y-1">
          <span className="font-bold text-[#1C1B18] block">
            2. What is Freeze Authority?
          </span>
          <p className="text-[#5C5852] leading-relaxed">
            If active, the creator can freeze your token account so you cannot transfer or sell your tokens. <strong>Revoked = Safe.</strong>
          </p>
        </div>
        <div className="space-y-1">
          <span className="font-bold text-[#1C1B18] block">
            3. What are Token-2022 Extensions?
          </span>
          <p className="text-[#5C5852] leading-relaxed">
            New Solana token features like <code>PermanentDelegate</code> (issuer can seize tokens) or hidden transfer fees encoded in raw bytes.
          </p>
        </div>
      </div>

      {/* Guided Sample Token Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#1C1B18]">
            Click a Sample Token Below to Inspect Live On-Chain Data:
          </span>
          <span className="text-[11px] font-mono text-[#5C5852]">
            Mainnet &amp; Devnet TLV Unpacking
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESET_MINTS.map((p) => {
            const isSelected = mintInput === p.mint;
            const badgeStyle =
              p.tone === "emerald"
                ? "bg-[#EBF5EE] text-[#166534] border-[#C5E3CD]"
                : p.tone === "amber"
                ? "bg-[#FDF8E8] text-[#854D0E] border-[#F3E0A2]"
                : p.tone === "rose"
                ? "bg-[#FDF2F2] text-[#991B1B] border-[#F5C6C6]"
                : "bg-[#F4F1EA] text-[#4A4742] border-[#E5E0D8]";

            return (
              <button
                key={p.mint}
                type="button"
                disabled={isScanning}
                onClick={() => {
                  setMintInput(p.mint);
                  setCluster(p.cluster);
                  runScan(p.mint, p.cluster);
                }}
                className={`rounded-lg border p-3.5 text-left transition flex flex-col justify-between gap-2 bg-[#FAF9F5] hover:bg-[#F4F1EA] border-[#E5E0D8] disabled:opacity-50 ${
                  isSelected ? "ring-2 ring-[#1C1B18] bg-white" : ""
                }`}
              >
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#5C5852]">
                      {p.stepTag}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeStyle}`}
                    >
                      {p.expectedBadge}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-[#1C1B18]">
                    {p.label}
                  </div>
                </div>
                <p className="text-[11px] text-[#5C5852] leading-relaxed">
                  {p.summary}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mint Search Bar */}
      <div className="pt-2 border-t border-[#E5E0D8] space-y-2">
        <label
          htmlFor="mint-address-input"
          className="text-xs font-semibold text-[#1C1B18] block"
        >
          Or Paste Any Solana Token Mint Address:
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3.5 h-3.5 w-3.5 text-[#5C5852]" />
            <input
              id="mint-address-input"
              type="text"
              value={mintInput}
              onChange={(e) => setMintInput(e.target.value)}
              placeholder="Paste any Solana SPL Token or Token-2022 Mint address..."
              className="w-full obsidian-input pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-mono text-[#1C1B18] placeholder-[#8A857D] outline-none transition"
            />
          </div>
          <button
            type="button"
            disabled={isScanning || !mintInput.trim()}
            onClick={() => runScan(mintInput, cluster)}
            className="btn-editorial-primary px-6 py-2.5 text-xs sm:text-sm font-bold transition shadow-sm shrink-0"
          >
            {isScanning ? "Unpacking On-Chain Bytes..." : "Inspect Mint Layout"}
          </button>
        </div>
      </div>

      {scanError && (
        <div className="rounded-md border border-[#F5C6C6] bg-[#FDF2F2] p-4 text-xs font-mono text-[#991B1B]">
          <strong>Invalid Mint Request:</strong> {scanError}
        </div>
      )}

      {report ? (
        <div className="space-y-4 pt-3 border-t border-[#E5E0D8]">
          <div className="flex items-center gap-2">
            <span className="step-number">02</span>
            <h3 className="text-sm sm:text-base font-bold text-[#1C1B18]">
              Live On-Chain Audit Report
            </h3>
          </div>

          {/* Verdict Banner */}
          <div className="rounded-lg border border-[#E5E0D8] bg-[#FAF9F5] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2.5 py-1 text-xs font-mono font-bold border flex items-center gap-1.5 ${
                    report.verdict === "SAFE"
                      ? "bg-[#EBF5EE] text-[#166534] border-[#C5E3CD]"
                      : report.verdict === "CAUTION"
                      ? "bg-[#FDF8E8] text-[#854D0E] border-[#F3E0A2]"
                      : "bg-[#FDF2F2] text-[#991B1B] border-[#F5C6C6]"
                  }`}
                >
                  {report.verdict === "SAFE" ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : report.verdict === "CAUTION" ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {report.verdict} · {report.riskScore}/100 Risk Score
                  </span>
                </span>
                <span className="rounded bg-white border border-[#E5E0D8] px-2.5 py-1 text-xs font-mono font-semibold text-[#1C1B18]">
                  {report.tokenStandard}
                </span>
                <span className="rounded bg-white border border-[#E5E0D8] px-2.5 py-1 text-xs font-mono text-[#5C5852]">
                  Cluster: {report.cluster}
                </span>
              </div>
              <p className="text-xs font-mono text-[#5C5852] break-all pt-1">
                Inspected Mint: {report.mint}
              </p>
            </div>

            {report.decimals !== null && (
              <div className="sm:text-right text-xs font-mono space-y-1 bg-white p-3 rounded border border-[#E5E0D8]">
                <div className="text-[#5C5852]">
                  Decimals:{" "}
                  <span className="text-[#1C1B18] font-bold">
                    {report.decimals}
                  </span>
                </div>
                {report.supplyUi !== null && (
                  <div className="text-[#5C5852]">
                    Total Supply:{" "}
                    <span className="text-[#1C1B18] font-bold">
                      {report.supplyUi.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Authority & Extension Telemetry */}
          {report.isMintAccount && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md border border-[#E5E0D8] bg-white p-4 space-y-1.5">
                <span className="text-[10px] uppercase text-[#5C5852] font-mono block font-bold">
                  Mint Authority (Supply Control)
                </span>
                <span
                  className={`text-sm font-mono font-bold block ${
                    report.mintAuthorityRevoked
                      ? "text-[#166534]"
                      : "text-[#854D0E]"
                  }`}
                >
                  {report.mintAuthorityRevoked
                    ? "Revoked (Fixed Supply ✓)"
                    : "Active (Creator Can Mint)"}
                </span>
                <p className="text-[11px] text-[#5C5852]">
                  {report.mintAuthorityRevoked
                    ? "No one can print new tokens."
                    : `Controlled by ${report.mintAuthority?.slice(0, 8)}...`}
                </p>
              </div>

              <div className="rounded-md border border-[#E5E0D8] bg-white p-4 space-y-1.5">
                <span className="text-[10px] uppercase text-[#5C5852] font-mono block font-bold">
                  Freeze Authority (Wallet Lock)
                </span>
                <span
                  className={`text-sm font-mono font-bold block ${
                    report.freezeAuthorityRevoked
                      ? "text-[#166534]"
                      : "text-[#991B1B]"
                  }`}
                >
                  {report.freezeAuthorityRevoked
                    ? "Revoked (Cannot Freeze ✓)"
                    : "Active (Can Freeze Balances)"}
                </span>
                <p className="text-[11px] text-[#5C5852]">
                  {report.freezeAuthorityRevoked
                    ? "Your token balance cannot be frozen."
                    : `Controlled by ${report.freezeAuthority?.slice(0, 8)}...`}
                </p>
              </div>

              <div className="rounded-md border border-[#E5E0D8] bg-white p-4 space-y-1.5">
                <span className="text-[10px] uppercase text-[#5C5852] font-mono block font-bold">
                  Token-2022 Binary Extensions
                </span>
                <span className="text-sm font-mono font-bold text-[#1C1B18] block">
                  {report.extensions.length > 0
                    ? `${report.extensions.length} Extension(s) Found`
                    : "None (Standard SPL Token)"}
                </span>
                <p className="text-[11px] font-mono text-[#5C5852] truncate">
                  {report.extensions.length > 0
                    ? report.extensions.join(", ")
                    : "Standard 82-byte Mint account"}
                </p>
              </div>
            </div>
          )}

          {/* Plain-English Summary */}
          <div className="rounded-md border border-[#E5E0D8] bg-[#FAF9F5] p-4 space-y-1.5">
            <span className="text-xs font-bold text-[#1C1B18] block">
              Plain-English Audit Takeaways:
            </span>
            {report.bullets.map((b, i) => (
              <p
                key={i}
                className="text-xs text-[#383531] flex items-start gap-2"
              >
                <span className="text-[#1C1B18] font-bold">•</span>
                <span>{b}</span>
              </p>
            ))}
          </div>

          {/* Detailed Findings */}
          <div className="grid grid-cols-1 gap-2">
            {report.findings.map((f) => (
              <div
                key={f.id}
                className={`rounded-md border px-4 py-3 text-xs flex items-start justify-between gap-3 ${
                  f.passed
                    ? "border-[#E5E0D8] bg-white text-[#383531]"
                    : "border-[#F5C6C6] bg-[#FDF2F2] text-[#991B1B]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {f.passed ? (
                    <Check className="h-4 w-4 text-[#166534] shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-4 w-4 text-[#991B1B] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold text-[#1C1B18]">{f.label}:</span>{" "}
                    <span className="text-[#383531]">{f.detail}</span>
                  </div>
                </div>
                {f.penalty > 0 && (
                  <span className="shrink-0 rounded bg-[#FBE4E4] border border-[#F5C6C6] px-2 py-0.5 text-[10px] font-mono font-bold text-[#991B1B]">
                    +{f.penalty} risk
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#D6D1C7] bg-[#FAF9F5] p-6 text-center space-y-2">
          <Info className="h-5 w-5 text-[#5C5852] mx-auto" />
          <p className="text-xs sm:text-sm font-semibold text-[#1C1B18]">
            Click any of the 4 sample token cards above or click &quot;Inspect Mint Layout&quot; to generate a live on-chain audit report.
          </p>
        </div>
      )}
    </section>
  );
}
