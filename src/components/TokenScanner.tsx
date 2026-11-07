"use client";

import React, { useState } from "react";
import type { TokenScanReport } from "@/lib/solana/scanner";
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Sliders,
  Check,
  X,
  ExternalLink,
  Shield,
  HelpCircle,
} from "lucide-react";

const PRESET_MINTS = [
  {
    label: "Wrapped SOL (Revoked / Safe)",
    mint: "So11111111111111111111111111111111111111112",
    cluster: "mainnet-beta" as const,
  },
  {
    label: "Mainnet USDC (Freeze Auth Active)",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    cluster: "mainnet-beta" as const,
  },
  {
    label: "PayPal USD (Token-2022 PermanentDelegate)",
    mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    cluster: "mainnet-beta" as const,
  },
  {
    label: "Devnet USDC",
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
    <section className="bg-white border border-[#E7E4DC] rounded-lg p-5 sm:p-6 space-y-6 text-[#1C1B1A] shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7E4DC] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-[#F3F1EC] border border-[#DDD9CE] flex items-center justify-center text-[#1C1B1A] shrink-0">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#1C1B1A] tracking-tight">
              Token Security &amp; Token-2022 Auditor
            </h2>
            <p className="text-xs text-[#66635D]">
              Inspect on-chain Mint Authority, Freeze Authority, and Token-2022 TLV binary extensions before transacting.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#F8F7F4] px-3 py-1.5 rounded-md border border-[#DDD9CE]">
          <Sliders className="h-3.5 w-3.5 text-[#66635D]" />
          <select
            aria-label="Solana cluster selector"
            value={cluster}
            onChange={(e) =>
              setCluster(e.target.value as "auto" | "mainnet-beta" | "devnet")
            }
            className="bg-transparent text-xs font-mono font-medium text-[#1C1B1A] outline-none cursor-pointer"
          >
            <option value="auto">Auto-Detect Cluster</option>
            <option value="mainnet-beta">Mainnet-Beta Only</option>
            <option value="devnet">Devnet Only</option>
          </select>
        </div>
      </div>

      {/* Preset Mint Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#66635D]">
          <span className="font-semibold text-[#1C1B1A]">
            Quick Presets (Token-2022 &amp; SPL Mints):
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F8F7F4] border border-[#E7E4DC]">
            Mainnet &amp; Devnet TLV
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_MINTS.map((p) => (
            <button
              key={p.mint}
              type="button"
              disabled={isScanning}
              onClick={() => {
                setMintInput(p.mint);
                setCluster(p.cluster);
                runScan(p.mint, p.cluster);
              }}
              className="rounded-md border border-[#DDD9CE] bg-[#F8F7F4] hover:bg-[#F3F1EC] px-3 py-1.5 text-xs font-mono text-[#1C1B1A] transition disabled:opacity-50 shadow-sm"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mint Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="text"
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          placeholder="Paste any Solana SPL Token or Token-2022 Mint address..."
          className="flex-1 bg-white border border-[#DDD9CE] focus:border-[#1C1B1A] rounded-md px-3.5 py-2.5 text-xs sm:text-sm font-mono text-[#1C1B1A] placeholder-[#8C887F] outline-none transition"
        />
        <button
          type="button"
          disabled={isScanning || !mintInput.trim()}
          onClick={() => runScan(mintInput, cluster)}
          className="bg-[#1C1B1A] hover:bg-[#33312E] disabled:opacity-50 px-5 py-2.5 text-xs sm:text-sm font-medium text-white rounded-md transition shadow-sm shrink-0"
        >
          {isScanning ? "Unpacking TLV Data..." : "Inspect Mint Layout"}
        </button>
      </div>

      {scanError && (
        <div className="rounded-md border border-[#F0CDCD] bg-[#FDF4F4] p-3.5 text-xs font-mono text-[#8C2323]">
          <strong>Invalid Mint Request:</strong> {scanError}
        </div>
      )}

      {report && (
        <div className="space-y-4 pt-1">
          {/* Verdict Banner */}
          <div className="rounded-lg border border-[#E7E4DC] bg-[#F8F7F4] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2.5 py-0.5 text-xs font-mono font-bold border ${
                    report.verdict === "SAFE"
                      ? "bg-[#EBF4EE] text-[#1B6635] border-[#CDE8D5]"
                      : report.verdict === "CAUTION"
                      ? "bg-[#FFF8E6] text-[#8C6D1F] border-[#EEDB9F]"
                      : "bg-[#FDF4F4] text-[#A83838] border-[#F0CDCD]"
                  }`}
                >
                  {report.verdict} · {report.riskScore}/100 Risk
                </span>
                <span className="rounded bg-white border border-[#E7E4DC] px-2 py-0.5 text-xs font-mono text-[#1C1B1A]">
                  {report.tokenStandard}
                </span>
                <span className="rounded bg-white border border-[#E7E4DC] px-2 py-0.5 text-xs font-mono text-[#66635D]">
                  {report.cluster}
                </span>
              </div>
              <p className="text-xs font-mono text-[#66635D] break-all pt-1">
                Mint: {report.mint}
              </p>
            </div>

            {report.decimals !== null && (
              <div className="sm:text-right text-xs font-mono space-y-1">
                <div className="text-[#66635D]">
                  Decimals: <span className="text-[#1C1B1A] font-bold">{report.decimals}</span>
                </div>
                {report.supplyUi !== null && (
                  <div className="text-[#66635D]">
                    Supply:{" "}
                    <span className="text-[#1C1B1A] font-bold">
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
              <div className="rounded-md border border-[#E7E4DC] bg-white p-3.5 space-y-1 font-mono">
                <span className="text-[10px] uppercase text-[#8C887F] block font-semibold">
                  Mint Authority
                </span>
                <span
                  className={`text-sm font-bold ${
                    report.mintAuthorityRevoked
                      ? "text-[#1B6635]"
                      : "text-[#8C6D1F]"
                  }`}
                >
                  {report.mintAuthorityRevoked ? "Revoked (Fixed Supply)" : "Active (Can Mint)"}
                </span>
                {report.mintAuthority && (
                  <span className="text-[10px] text-[#66635D] block truncate">
                    {report.mintAuthority}
                  </span>
                )}
              </div>

              <div className="rounded-md border border-[#E7E4DC] bg-white p-3.5 space-y-1 font-mono">
                <span className="text-[10px] uppercase text-[#8C887F] block font-semibold">
                  Freeze Authority
                </span>
                <span
                  className={`text-sm font-bold ${
                    report.freezeAuthorityRevoked
                      ? "text-[#1B6635]"
                      : "text-[#A83838]"
                  }`}
                >
                  {report.freezeAuthorityRevoked
                    ? "Revoked (Safe)"
                    : "Active (Can Freeze User Balances)"}
                </span>
                {report.freezeAuthority && (
                  <span className="text-[10px] text-[#66635D] block truncate">
                    {report.freezeAuthority}
                  </span>
                )}
              </div>

              <div className="rounded-md border border-[#E7E4DC] bg-white p-3.5 space-y-1 font-mono">
                <span className="text-[10px] uppercase text-[#8C887F] block font-semibold">
                  Token-2022 Extensions
                </span>
                <span className="text-sm font-bold text-[#1C1B1A]">
                  {report.extensions.length > 0
                    ? `${report.extensions.length} Detected`
                    : "None (Standard)"}
                </span>
                <span className="text-[10px] text-[#66635D] block truncate">
                  {report.extensions.length > 0
                    ? report.extensions.join(", ")
                    : "Standard 82-byte Mint"}
                </span>
              </div>
            </div>
          )}

          {/* Plain-English Summary */}
          <div className="rounded-md border border-[#E7E4DC] bg-[#F8F7F4] p-3.5 space-y-1.5 font-mono">
            {report.bullets.map((b, i) => (
              <p key={i} className="text-xs text-[#383531] flex items-start gap-2">
                <span className="text-[#1C1B1A] font-bold">•</span>
                <span>{b}</span>
              </p>
            ))}
          </div>

          {/* Detailed Findings */}
          <div className="grid grid-cols-1 gap-2 font-mono">
            {report.findings.map((f) => (
              <div
                key={f.id}
                className={`rounded-md border px-3.5 py-2.5 text-xs flex items-start justify-between gap-3 ${
                  f.passed
                    ? "border-[#E7E4DC] bg-white text-[#383531]"
                    : "border-[#F0CDCD] bg-[#FDF4F4] text-[#A83838]"
                }`}
              >
                <div className="flex items-start gap-2">
                  {f.passed ? (
                    <Check className="h-4 w-4 text-[#1B6635] shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-4 w-4 text-[#A83838] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-[#1C1B1A]">{f.label}:</span>{" "}
                    <span className="text-[#383531]">{f.detail}</span>
                  </div>
                </div>
                {f.penalty > 0 && (
                  <span className="shrink-0 rounded bg-[#FDF4F4] border border-[#F0CDCD] px-2 py-0.5 text-[10px] font-bold text-[#A83838]">
                    +{f.penalty}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
