"use client";

import React, { useState } from "react";
import type { TokenScanReport } from "@/lib/solana/scanner";

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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 sm:p-7 space-y-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🔍</span> SPL Token &amp; Token-2022 Safety Scanner
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Inspect on-chain Mint Authority, Freeze Authority, holder concentration, and Token-2022 TLV hooks before trading.
          </p>
        </div>
        <select
          aria-label="Solana cluster selector"
          value={cluster}
          onChange={(e) =>
            setCluster(e.target.value as "auto" | "mainnet-beta" | "devnet")
          }
          className="self-start sm:self-auto rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-indigo-300"
        >
          <option value="auto">Auto-Detect (Mainnet → Devnet)</option>
          <option value="mainnet-beta">Mainnet-Beta Only</option>
          <option value="devnet">Devnet Only</option>
        </select>
      </div>

      {/* Preset Mint Chips */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          1-Click Token Inspection Presets:
        </span>
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
              className="rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mint Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          placeholder="Paste any Solana SPL Token or Token-2022 Mint address..."
          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-mono text-white placeholder-slate-500 outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          disabled={isScanning || !mintInput.trim()}
          onClick={() => runScan(mintInput, cluster)}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 px-6 py-3 text-sm font-semibold text-white transition shrink-0"
        >
          {isScanning ? "Unpacking Mint..." : "Inspect On-Chain Mint"}
        </button>
      </div>

      {scanError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-200">
          <strong>Invalid Mint Request:</strong> {scanError}
        </div>
      )}

      {report && (
        <div className="space-y-5 pt-2">
          {/* Verdict Banner */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-bold border ${
                    report.verdict === "SAFE"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : report.verdict === "CAUTION"
                      ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
                      : "bg-rose-500/20 text-rose-200 border-rose-500/40"
                  }`}
                >
                  {report.verdict} · {report.riskScore}/100 Risk
                </span>
                <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono text-indigo-300">
                  {report.tokenStandard}
                </span>
                <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400">
                  {report.cluster}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 break-all pt-1">
                Mint: {report.mint}
              </p>
            </div>

            {report.decimals !== null && (
              <div className="sm:text-right text-xs font-mono space-y-1">
                <div className="text-slate-400">
                  Decimals: <span className="text-white">{report.decimals}</span>
                </div>
                {report.supplyUi !== null && (
                  <div className="text-slate-400">
                    Supply:{" "}
                    <span className="text-white">
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
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-1">
                <span className="text-[11px] uppercase text-slate-400 block">
                  Mint Authority
                </span>
                <span
                  className={`text-sm font-bold ${
                    report.mintAuthorityRevoked
                      ? "text-emerald-400"
                      : "text-amber-300"
                  }`}
                >
                  {report.mintAuthorityRevoked ? "Revoked (Fixed)" : "Active"}
                </span>
                {report.mintAuthority && (
                  <span className="text-[11px] font-mono text-slate-400 block truncate">
                    {report.mintAuthority}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-1">
                <span className="text-[11px] uppercase text-slate-400 block">
                  Freeze Authority
                </span>
                <span
                  className={`text-sm font-bold ${
                    report.freezeAuthorityRevoked
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {report.freezeAuthorityRevoked
                    ? "Revoked (Safe)"
                    : "Active (Can Freeze)"}
                </span>
                {report.freezeAuthority && (
                  <span className="text-[11px] font-mono text-slate-400 block truncate">
                    {report.freezeAuthority}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-1">
                <span className="text-[11px] uppercase text-slate-400 block">
                  Token-2022 Extensions
                </span>
                <span className="text-sm font-bold text-white">
                  {report.extensions.length > 0
                    ? `${report.extensions.length} Detected`
                    : "None (Standard)"}
                </span>
                <span className="text-[11px] font-mono text-slate-400 block truncate">
                  {report.extensions.length > 0
                    ? report.extensions.join(", ")
                    : "Standard 82-byte Mint"}
                </span>
              </div>
            </div>
          )}

          {/* Plain-English Summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-1.5">
            {report.bullets.map((b, i) => (
              <p key={i} className="text-xs sm:text-sm text-slate-200">
                {b}
              </p>
            ))}
          </div>

          {/* Detailed Findings */}
          <div className="grid grid-cols-1 gap-2">
            {report.findings.map((f) => (
              <div
                key={f.id}
                className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-start justify-between gap-3 ${
                  f.passed
                    ? "border-slate-800 bg-slate-950/60 text-slate-300"
                    : "border-rose-500/40 bg-rose-950/30 text-rose-200"
                }`}
              >
                <div>
                  <span className="font-semibold">
                    {f.passed ? "✓ " : "✖ "}
                    {f.label}:
                  </span>{" "}
                  <span className="text-slate-300">{f.detail}</span>
                </div>
                {f.penalty > 0 && (
                  <span className="shrink-0 rounded bg-rose-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-300">
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
