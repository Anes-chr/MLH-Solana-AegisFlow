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
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
          ℹ️ Unsupported Request
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          AegisFlow strictly scopes execution to audited SOL → dUSDC swaps, direct SOL transfers, and read-only portfolio checks. No transaction was built.
        </p>
        {warnings.length > 0 && (
          <ul className="space-y-1 text-xs text-slate-400">
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
        border: "border-emerald-500/35",
        badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        bar: "bg-emerald-500",
        label: "SAFE · APPROVED",
      }
    : isCaution
    ? {
        border: "border-amber-500/40",
        badge: "bg-amber-500/20 text-amber-200 border-amber-500/40",
        bar: "bg-amber-400",
        label: "CAUTION · REVIEW",
      }
    : {
        border: "border-rose-500/50",
        badge: "bg-rose-500/20 text-rose-200 border-rose-500/40",
        bar: "bg-rose-500",
        label: "BLOCKED BY POLICY GATE",
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
      className={`rounded-2xl border ${bandColors.border} bg-slate-900/80 p-5 sm:p-6 space-y-5 shadow-xl`}
    >
      {/* Header & Risk Score Gauge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-bold tracking-wide ${bandColors.badge}`}
            >
              {bandColors.label}
            </span>
            <span className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-400">
              Deterministic Policy · LLM Cannot Override
            </span>
          </div>
          <h3 className="text-lg font-bold text-white pt-1">
            Pre-Flight Sentinel Risk Assessment
          </h3>
        </div>

        <div className="sm:text-right space-y-1.5 min-w-[160px]">
          <div className="flex sm:justify-end items-baseline gap-1">
            <span className="text-3xl font-black font-mono text-white">
              {score}
            </span>
            <span className="text-xs font-mono text-slate-400">/ 100 risk</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${bandColors.bar}`}
              style={{ width: `${Math.max(4, score)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Read-Only Portfolio Snapshot */}
      {portfolio && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <span className="text-[11px] uppercase text-slate-400 block">
              Inspected Wallet
            </span>
            <span className="text-xs font-mono text-white">
              {portfolio.walletPubkey.slice(0, 6)}...{portfolio.walletPubkey.slice(-6)}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase text-slate-400 block">
              Devnet SOL Balance
            </span>
            <span className="text-base font-bold font-mono text-emerald-300">
              {portfolio.solBalance.toFixed(4)} SOL
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase text-slate-400 block">
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
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Simulated Balance Deltas &amp; Gas Telemetry
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-mono text-indigo-300">
                {sim.unitsConsumed.toLocaleString()} CU
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-mono text-slate-300">
                Fee: {sim.feeSol.toFixed(6)} SOL
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 flex items-center justify-between">
              <span className="text-xs text-slate-400">Wallet SOL Delta</span>
              <span
                className={`text-sm font-mono font-bold ${
                  sim.solDeltaUser < 0 ? "text-amber-300" : "text-slate-300"
                }`}
              >
                {sim.solDeltaUser > 0 ? "+" : ""}
                {sim.solDeltaUser.toFixed(6)} SOL
              </span>
            </div>

            {sim.dUsdcDeltaUser !== 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 flex items-center justify-between">
                <span className="text-xs text-slate-400">Wallet dUSDC Delta</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  +{sim.dUsdcDeltaUser.toFixed(4)} dUSDC
                </span>
              </div>
            ) : sim.solDeltaRecipient ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 flex items-center justify-between">
                <span className="text-xs text-slate-400">Recipient SOL Inflow</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  +{sim.solDeltaRecipient.toFixed(6)} SOL
                </span>
              </div>
            ) : null}
          </div>

          {sim.isSimulatedFallback && (
            <p className="text-[11px] text-slate-400 font-mono">
              ℹ️ Devnet account currently holds 0 SOL — balance deltas verified from compiled instruction layout + live Devnet RPC pre-flight check.
            </p>
          )}
        </div>
      )}

      {/* Oracle & Stretch S4 Live Mainnet Reference Quote */}
      {market && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-medium">
              Live SOL/USD Reference ({market.source}):
            </span>
            <span className="font-mono font-semibold text-white">
              ${market.priceUsd.toFixed(2)} ± ${market.confidence.toFixed(2)}
            </span>
          </div>

          {jupiterQuote && jupiterQuote.available && (
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-indigo-300 font-medium">
                  Jupiter Mainnet Liquidity Quote (
                  {jupiterQuote.routeLabels.length > 0
                    ? jupiterQuote.routeLabels.slice(0, 2).join(" → ")
                    : "Direct AMM"}
                  ):
                </span>
                <span className="font-mono text-emerald-300 font-semibold">
                  {jupiterQuote.outAmountUsdc?.toFixed(4)} USDC ($
                  {jupiterQuote.impliedSolUsd?.toFixed(2)}/SOL ·{" "}
                  {jupiterQuote.divergenceFromPythPct?.toFixed(2)}% spread)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Mainnet reference price via Jupiter (read-only; Devnet swap executes atomically via AegisFlow Devnet Vault).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sentinel Plain-English Explanation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Plain-English Security Summary
          </span>
          <span className="text-[11px] font-mono text-indigo-400">
            {risk.explanationSource === "gemini"
              ? "Gemini Flash Lite"
              : "Deterministic Sentinel"}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-1.5">
          {risk.bullets.map((bullet, idx) => (
            <p key={idx} className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {bullet}
            </p>
          ))}
        </div>
      </div>

      {/* Deterministic Policy Findings Checklist */}
      {risk.findings.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            6-Point Guardrail Audit
          </span>
          <div className="grid grid-cols-1 gap-2">
            {risk.findings.map((f) => (
              <div
                key={f.id}
                className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-start justify-between gap-3 ${
                  f.passed
                    ? "border-slate-800 bg-slate-950/60 text-slate-300"
                    : "border-rose-500/40 bg-rose-950/30 text-rose-200"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span className={f.passed ? "text-emerald-400" : "text-rose-400"}>
                      {f.passed ? "✓" : "✖"}
                    </span>
                    <span>{f.check}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{f.detail}</p>
                </div>
                {f.penalty > 0 && (
                  <span className="shrink-0 rounded bg-rose-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-300">
                    +{f.penalty} risk
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verifiable AI On-Chain Memo Fingerprint */}
      {plan && (
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/15 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300 block">
              Verifiable AI On-Chain SPL Memo Anchor
            </span>
            <code className="text-xs font-mono text-slate-300 truncate block">
              aegis:v1:{plan.sha256.slice(0, 12)}...{plan.sha256.slice(-10)}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopyHash}
            className="self-start sm:self-auto shrink-0 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition"
          >
            {copiedHash ? "Copied Memo ✓" : "Copy Full Memo"}
          </button>
        </div>
      )}
    </section>
  );
}
