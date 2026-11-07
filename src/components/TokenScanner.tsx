"use client";

import React, { useState, useEffect } from "react";
import { Keypair } from "@solana/web3.js";
import {
  type TokenScanReport,
  evaluateMintSafety,
} from "@/lib/solana/scanner";
import {
  Search,
  Sliders,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Wrench,
  Cpu,
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

  // Interactive Custom Token-2022 Risk Simulator State
  const [simMintAuthActive, setSimMintAuthActive] = useState(false);
  const [simFreezeAuthActive, setSimFreezeAuthActive] = useState(true);
  const [simPermDelegate, setSimPermDelegate] = useState(true);
  const [simTransferHook, setSimTransferHook] = useState(false);
  const [simTransferFee, setSimTransferFee] = useState(false);
  const [simRestrictive, setSimRestrictive] = useState(false);
  const [simTopHolderPct, setSimTopHolderPct] = useState(15);
  const [simZeroSupply, setSimZeroSupply] = useState(false);

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

  // Auto-run initial scan on mount so the section is immediately populated and interactive
  useEffect(() => {
    runScan(PRESET_MINTS[2].mint, "mainnet-beta");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScanRandomAccount = () => {
    const randomPk = Keypair.generate().publicKey.toBase58();
    setMintInput(randomPk);
    setCluster("devnet");
    runScan(randomPk, "devnet");
  };

  // Compute live custom Token-2022 simulation using the real deterministic engine
  const activeSimExtensions: string[] = [];
  if (simPermDelegate) activeSimExtensions.push("permanentDelegate");
  if (simTransferHook) activeSimExtensions.push("transferHook");
  if (simTransferFee) activeSimExtensions.push("transferFeeConfig");
  if (simRestrictive) activeSimExtensions.push("pausableConfig");

  const customSimEvaluation = evaluateMintSafety({
    mintAuthority: simMintAuthActive
      ? "CreatorAuth9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGY"
      : null,
    freezeAuthority: simFreezeAuthActive
      ? "FreezeAuth4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uas"
      : null,
    supplyRaw: simZeroSupply ? 0n : 1_000_000_000_000n,
    decimals: 6,
    isToken2022: activeSimExtensions.length > 0,
    extensions: activeSimExtensions,
    topHolderPct: simTopHolderPct,
  });

  return (
    <div className="space-y-6 text-[#1C1B18]">
      {/* PART 1: LIVE ON-CHAIN SPL & TOKEN-2022 SCANNER */}
      <section className="obsidian-card p-5 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E0D8] pb-5">
          <div className="flex items-start gap-3.5">
            <div className="step-number mt-0.5">01</div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1C1B18] tracking-tight">
                Live On-Chain Token Security Auditor (SPL + Token-2022)
              </h2>
              <p className="text-xs sm:text-sm text-[#5C5852] mt-1 leading-relaxed">
                Unpacks raw binary Mint accounts on Solana Mainnet &amp; Devnet to detect active Mint/Freeze authorities and hidden Token-2022 TLV extensions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#F4F1EA] px-3.5 py-2 rounded-md border border-[#E5E0D8] shrink-0 self-start sm:self-auto whitespace-nowrap">
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

        {/* Guided Sample Token Cards */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#1C1B18]">
              Click Any Real Token or Generate a Fresh Uninitialized Address:
            </span>
            <button
              type="button"
              disabled={isScanning}
              onClick={handleScanRandomAccount}
              className="px-2.5 py-1 rounded bg-[#F4F1EA] hover:bg-[#EAE6DC] border border-[#D6D1C7] text-[11px] font-mono font-semibold text-[#1C1B18] transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Test Random Fresh Keypair (Non-Mint)</span>
            </button>
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
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border whitespace-nowrap ${badgeStyle}`}
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
              className="btn-editorial-primary px-6 py-2.5 text-xs sm:text-sm font-bold transition shadow-sm shrink-0 whitespace-nowrap"
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

        {report && (
          <div className="space-y-4 pt-3 border-t border-[#E5E0D8]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="step-number">02</span>
                <h3 className="text-sm sm:text-base font-bold text-[#1C1B18]">
                  Live On-Chain Audit Report
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#5C5852]">
                Scanned at {new Date(report.scannedAt).toLocaleTimeString()}
              </span>
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
                  Inspected Address: {report.mint}
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
                    <span className="shrink-0 rounded bg-[#FBE4E4] border border-[#F5C6C6] px-2 py-0.5 text-[10px] font-mono font-bold text-[#991B1B] whitespace-nowrap">
                      +{f.penalty} risk
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* PART 2: INTERACTIVE TOKEN-2022 EXTENSION & AUTHORITY SIMULATOR */}
      <section className="obsidian-card p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E0D8] pb-4">
          <div className="flex items-start gap-3.5">
            <div className="step-number mt-0.5">03</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#1C1B18]">
                  Interactive Token-2022 Rug-Pull Simulator (Toggle Extensions Live)
                </h2>
                <span className="badge-neutral font-mono text-[10px]">
                  Real-Time TLV Evaluator
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#5C5852] mt-1">
                Toggle authorities and Token-2022 binary extensions below to see how AegisFlow&apos;s{" "}
                <code>evaluateMintSafety()</code> engine scores custom token configurations in real time.
              </p>
            </div>
          </div>

          <div className="sm:text-right bg-[#FAF9F5] px-4 py-2.5 rounded-lg border border-[#E5E0D8] shrink-0">
            <div className="text-[10px] font-mono uppercase text-[#5C5852] font-bold">
              Simulated Token Verdict
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-lg font-extrabold font-mono ${
                  customSimEvaluation.verdict === "SAFE"
                    ? "text-[#166534]"
                    : customSimEvaluation.verdict === "CAUTION"
                    ? "text-[#854D0E]"
                    : "text-[#991B1B]"
                }`}
              >
                {customSimEvaluation.verdict} ({customSimEvaluation.riskScore}/100)
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Interactive Switches & Sliders */}
          <div className="lg:col-span-6 space-y-3 bg-[#FAF9F5] p-4 rounded-lg border border-[#E5E0D8] text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D8]">
              <span className="font-bold text-[#1C1B18] flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                <span>Configure Custom Mint Flags:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSimMintAuthActive(false);
                  setSimFreezeAuthActive(false);
                  setSimPermDelegate(false);
                  setSimTransferHook(false);
                  setSimTransferFee(false);
                  setSimRestrictive(false);
                  setSimTopHolderPct(10);
                  setSimZeroSupply(false);
                }}
                className="text-[11px] font-mono underline font-semibold text-[#1C1B18]"
              >
                Reset All to Safe (0/100)
              </button>
            </div>

            {[
              {
                label: "Active Mint Authority (Infinite Supply Risk)",
                penalty: "+30 risk",
                checked: simMintAuthActive,
                onChange: setSimMintAuthActive,
              },
              {
                label: "Active Freeze Authority (Can Lock Holder Wallets)",
                penalty: "+50 risk",
                checked: simFreezeAuthActive,
                onChange: setSimFreezeAuthActive,
              },
              {
                label: "Token-2022: PermanentDelegate (Can Seize/Burn Tokens)",
                penalty: "+50 risk",
                checked: simPermDelegate,
                onChange: setSimPermDelegate,
              },
              {
                label: "Token-2022: TransferHook (Arbitrary CPI on Transfer)",
                penalty: "+25 risk",
                checked: simTransferHook,
                onChange: setSimTransferHook,
              },
              {
                label: "Token-2022: TransferFeeConfig (Protocol Tax on Transfers)",
                penalty: "+20 risk",
                checked: simTransferFee,
                onChange: setSimTransferFee,
              },
              {
                label: "Token-2022: Pausable / DefaultFrozen State",
                penalty: "+20 risk",
                checked: simRestrictive,
                onChange: setSimRestrictive,
              },
              {
                label: "Zero Supply Mint (0 Tokens Minted)",
                penalty: "+25 risk",
                checked: simZeroSupply,
                onChange: setSimZeroSupply,
              },
            ].map((item, idx) => (
              <label
                key={idx}
                className="flex items-center justify-between gap-2 p-2.5 rounded bg-white border border-[#E5E0D8] cursor-pointer hover:bg-[#F4F1EA] transition"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="h-4 w-4 accent-[#1C1B18] rounded cursor-pointer"
                  />
                  <span className="font-medium text-[#1C1B18]">{item.label}</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap ${
                    item.checked
                      ? "bg-[#FDF2F2] text-[#991B1B] border border-[#F5C6C6] font-bold"
                      : "bg-[#F4F1EA] text-[#5C5852]"
                  }`}
                >
                  {item.penalty}
                </span>
              </label>
            ))}

            {/* Top Holder Whale Concentration Slider */}
            <div className="p-3 rounded bg-white border border-[#E5E0D8] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1C1B18]">
                  Top Single Holder Share:
                </span>
                <span
                  className={`font-mono font-bold ${
                    simTopHolderPct >= 50
                      ? "text-[#991B1B]"
                      : simTopHolderPct >= 25
                      ? "text-[#854D0E]"
                      : "text-[#166534]"
                  }`}
                >
                  {simTopHolderPct}% of Supply
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={95}
                step={1}
                value={simTopHolderPct}
                onChange={(e) => setSimTopHolderPct(Number(e.target.value))}
                className="w-full accent-[#1C1B18] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#5C5852]">
                <span>2% (Distributed)</span>
                <span>25%+ (+15 risk)</span>
                <span>50%+ (+30 risk)</span>
              </div>
            </div>
          </div>

          {/* Right: Live Evaluation Output */}
          <div className="lg:col-span-6 space-y-3">
            <div className="p-4 rounded-lg border border-[#E5E0D8] bg-[#FAF9F5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1C1B18] flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  <span>Live Evaluator Output (evaluateMintSafety)</span>
                </span>
                <span className="text-xs font-mono font-bold text-[#1C1B18]">
                  Score: {customSimEvaluation.riskScore} / 100
                </span>
              </div>
              <div className="h-2.5 w-full rounded-sm bg-[#EAE6DC] overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    customSimEvaluation.verdict === "SAFE"
                      ? "bg-[#166534]"
                      : customSimEvaluation.verdict === "CAUTION"
                      ? "bg-[#854D0E]"
                      : "bg-[#991B1B]"
                  }`}
                  style={{
                    width: `${Math.max(4, customSimEvaluation.riskScore)}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {customSimEvaluation.findings.map((f) => (
                <div
                  key={f.id}
                  className={`rounded-md border px-3.5 py-2.5 text-xs flex items-start justify-between gap-2 ${
                    f.passed
                      ? "border-[#E5E0D8] bg-white text-[#383531]"
                      : "border-[#F5C6C6] bg-[#FDF2F2] text-[#991B1B]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {f.passed ? (
                      <Check className="h-3.5 w-3.5 text-[#166534] shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-[#991B1B] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold text-[#1C1B18]">{f.label}:</span>{" "}
                      <span>{f.detail}</span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold whitespace-nowrap ${
                      f.passed
                        ? "bg-[#EBF5EE] text-[#166534]"
                        : "bg-[#FBE4E4] text-[#991B1B]"
                    }`}
                  >
                    {f.passed ? "PASS" : `+${f.penalty} risk`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
