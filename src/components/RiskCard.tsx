"use client";

import React, { useState } from "react";
import type {
  AgentPlanSummary,
  AgentRiskSummary,
  PortfolioSnapshot,
} from "@/lib/agent/graph";
import type { SimulationResult } from "@/lib/solana/simulation";
import type { PythPriceData } from "@/lib/solana/pyth";
import type { JupiterReferenceQuote } from "@/lib/solana/jupiter";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  Coins,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Scale,
  FileText,
  Info,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export interface RiskCardProps {
  status: "approved" | "caution" | "blocked" | "readonly" | "unsupported";
  risk: AgentRiskSummary | null;
  sim: SimulationResult | null;
  plan: AgentPlanSummary | null;
  market: PythPriceData | null;
  jupiterQuote: JupiterReferenceQuote | null;
  portfolio: PortfolioSnapshot | null;
  warnings?: string[];
}

export function RiskCard({
  status,
  risk,
  sim,
  plan,
  market,
  jupiterQuote,
  portfolio,
  warnings = [],
}: RiskCardProps) {
  const [copiedHash, setCopiedHash] = useState(false);

  if (!risk && status === "unsupported") {
    return (
      <div className="obsidian-card rounded-2xl p-6 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
          <Info className="h-3.5 w-3.5 text-cyan-400" />
          <span>Unsupported Request</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed font-mono">
          AegisFlow strictly scopes execution to audited SOL → dUSDC swaps, direct SOL transfers, and read-only portfolio checks. No transaction was built.
        </p>
        {warnings.length > 0 && (
          <ul className="space-y-1 text-xs text-slate-400 font-mono">
            {warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!risk) return null;

  const score = risk.score;
  const isSafe = risk.band === "safe";
  const isCaution = risk.band === "caution";

  const bandColors = isSafe
    ? {
        border: "border-emerald-500/30",
        glow: "glow-emerald",
        badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
        bar: "bg-emerald-500",
        label: "SAFE · APPROVED",
        Icon: ShieldCheck,
      }
    : isCaution
    ? {
        border: "border-amber-500/40",
        glow: "",
        badge: "bg-amber-500/10 text-amber-200 border-amber-500/30",
        bar: "bg-amber-400",
        label: "CAUTION · REVIEW",
        Icon: AlertTriangle,
      }
    : {
        border: "border-rose-500/40",
        glow: "glow-rose",
        badge: "bg-rose-500/10 text-rose-200 border-rose-500/30",
        bar: "bg-rose-500",
        label: "BLOCKED BY POLICY GATE",
        Icon: ShieldAlert,
      };

  const handleCopyHash = async () => {
    if (!plan?.memo) return;
    try {
      await navigator.clipboard.writeText(plan.memo);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <section
      className={`obsidian-card rounded-2xl p-5 sm:p-6 space-y-5 ${bandColors.border} ${bandColors.glow}`}
    >
      {/* Header & Risk Score Gauge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-bold font-mono tracking-wide flex items-center gap-1.5 ${bandColors.badge}`}
            >
              <bandColors.Icon className="h-3.5 w-3.5" />
              <span>{bandColors.label}</span>
            </span>
            <span className="rounded bg-black/40 border border-white/5 px-2 py-0.5 text-[11px] font-mono text-slate-400">
              Deterministic Policy · LLM Cannot Override
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white pt-1">
            Pre-Flight Sentinel Risk Assessment
          </h3>
        </div>

        <div className="sm:text-right space-y-1.5 min-w-[170px]">
          <div className="flex sm:justify-end items-baseline gap-1.5">
            <span className="text-3xl font-black font-mono text-white">
              {score}
            </span>
            <span className="text-xs font-mono text-slate-400">/ 100 risk score</span>
          </div>
          <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden border border-white/5">
            <div
              className={`h-full transition-all duration-300 ${bandColors.bar}`}
              style={{ width: `${Math.max(4, score)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Read-Only Portfolio Snapshot */}
      {portfolio && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <span className="text-[11px] uppercase text-slate-400 font-mono block">
              Inspected Wallet
            </span>
            <span className="text-xs font-mono text-white">
              {portfolio.walletPubkey.slice(0, 6)}...{portfolio.walletPubkey.slice(-6)}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase text-slate-400 font-mono block">
              Devnet SOL Balance
            </span>
            <span className="text-base font-bold font-mono text-emerald-400">
              {portfolio.solBalance.toFixed(4)} SOL
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase text-slate-400 font-mono block">
              Implied USD Value
            </span>
            <span className="text-base font-bold font-mono text-white">
              ${portfolio.solUsdValue.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Simulated Balance Deltas & Compute Units */}
      {sim && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>Simulated Balance Flow &amp; Gas</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-white/5 bg-black/40 px-2.5 py-1 text-xs font-mono text-cyan-300">
                {sim.unitsConsumed.toLocaleString()} CU
              </span>
              <span className="rounded-lg border border-white/5 bg-black/40 px-2.5 py-1 text-xs font-mono text-slate-300">
                Fee: {sim.feeSol.toFixed(6)} SOL
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 bg-black/40 p-3.5 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">You Send</span>
              <span
                className={`text-sm font-mono font-bold ${
                  sim.solDeltaUser < 0 ? "text-rose-400" : "text-slate-300"
                }`}
              >
                {sim.solDeltaUser > 0 ? "+" : ""}
                {sim.solDeltaUser.toFixed(6)} SOL
              </span>
            </div>

            {sim.dUsdcDeltaUser !== 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/40 p-3.5 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">You Receive</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  +{sim.dUsdcDeltaUser.toFixed(4)} dUSDC
                </span>
              </div>
            ) : sim.solDeltaRecipient ? (
              <div className="rounded-xl border border-white/5 bg-black/40 p-3.5 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">Recipient Inflow</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  +{sim.solDeltaRecipient.toFixed(6)} SOL
                </span>
              </div>
            ) : null}
          </div>

          {sim.isSimulatedFallback && (
            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
              <Info className="h-3 w-3 text-cyan-400 shrink-0" />
              <span>Simulated preview: instructions verified against live Devnet RPC blockhash and account layout.</span>
            </p>
          )}
        </div>
      )}

      {/* Oracle & Stretch S4 Live Mainnet Reference Quote */}
      {market && (
        <div className="rounded-xl border border-white/5 bg-black/40 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-mono flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-cyan-400" />
              <span>Live Pyth Oracle:</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white">
                ${market.priceUsd.toFixed(2)} USD
              </span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] font-mono text-cyan-300">
                Pyth Pull ({market.source})
              </span>
            </div>
          </div>

          {jupiterQuote && jupiterQuote.available && jupiterQuote.outAmountUsdc !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-white/5">
              <span className="text-slate-400 font-mono flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-indigo-400" />
                <span>Jupiter Mainnet Reference:</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-300">
                  ${jupiterQuote.outAmountUsdc.toFixed(2)} USDC
                </span>
                {jupiterQuote.divergenceFromPythPct !== null && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Spread: {Math.abs(Math.round(jupiterQuote.divergenceFromPythPct * 100))} bps
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deterministic Policy Finding Rule Breakdown */}
      {risk.findings && risk.findings.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            Deterministic Security Rules:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {risk.findings.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5"
              >
                <span className="text-slate-300 truncate">{f.check}</span>
                <span
                  className={`text-[11px] font-bold ${
                    f.passed ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {f.passed ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plain-English Sentinel Reasoning */}
      {(risk.bullets?.length > 0 || risk.explanation) && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-cyan-400" />
            <span>Sentinel Risk Summary ({risk.score}/100):</span>
          </span>
          <div className="rounded-xl border border-white/5 bg-black/40 p-4 text-xs font-mono text-slate-300 space-y-1.5 leading-relaxed">
            {(risk.bullets && risk.bullets.length > 0
              ? risk.bullets
              : risk.explanation.split("\n")
            )
              .filter((line) => line.trim().length > 0)
              .map((line, idx) => (
                <p key={idx} className="flex items-start gap-2 leading-snug min-w-0 truncate">
                  <span className="text-cyan-400 shrink-0">•</span>
                  <span className="truncate">{line.replace(/^[•\-*]\s*/, "")}</span>
                </p>
              ))}
          </div>
        </div>
      )}

      {/* On-Chain Cryptographic Memo Fingerprint */}
      {plan?.sha256 && (
        <div className="rounded-xl border border-white/5 bg-black/50 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="min-w-0 truncate leading-snug flex-1">
            <span className="text-slate-500">On-Chain Memo: </span>
            <span className="text-cyan-400">
              aegis:v1:{plan.sha256.slice(0, 12)}...{plan.sha256.slice(-10)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyHash}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition text-[11px]"
          >
            {copiedHash ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy Fingerprint</span>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
