"use client";

import React, { useState } from "react";
import type { TimelineStep, PipelineStageKey } from "@/lib/agent/graph";
import { Clock, CornerDownRight, X, HelpCircle } from "lucide-react";

export interface AgentTimelineProps {
  steps: TimelineStep[];
  isLoading: boolean;
  totalLatencyMs?: number | null;
}

const STAGE_META: Array<{
  key: PipelineStageKey;
  label: string;
  role: string;
  plainTip: string;
}> = [
  {
    key: "planner",
    label: "1. Planner",
    role: "Intent & Injection Filter",
    plainTip: "Translates English into structured parameters & checks for hacker overrides.",
  },
  {
    key: "scout",
    label: "2. Scout",
    role: "Pyth Oracle & Jupiter Spread",
    plainTip: "Fetches live SOL/USD prices from Pyth & compares against Jupiter DEX.",
  },
  {
    key: "builder",
    label: "3. Builder",
    role: "Atomic Tx & Memo Hash",
    plainTip: "Assembles the Solana instructions and attaches a SHA-256 audit hash.",
  },
  {
    key: "sentinel",
    label: "4. Sentinel",
    role: "RPC Simulation & Rules",
    plainTip: "Dry-runs the transaction on Solana Devnet and checks all 6 safety rules.",
  },
  {
    key: "gate",
    label: "5. Policy Gate",
    role: "Solana Blink Minting",
    plainTip: "Approves safe plans for signing or hard-blocks unsafe requests.",
  },
];

export function AgentTimeline({
  steps,
  isLoading,
  totalLatencyMs,
}: AgentTimelineProps) {
  const [expandedKey, setExpandedKey] = useState<PipelineStageKey | null>(null);

  const stepMap = new Map<PipelineStageKey, TimelineStep>();
  for (const s of steps) {
    stepMap.set(s.key, s);
  }

  return (
    <section className="obsidian-card p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E0D8] pb-4">
        <div className="flex items-start gap-3">
          <div className="step-number mt-0.5">02</div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#1C1B18]">
              5-Stage Multi-Agent Security Pipeline
            </h3>
            <p className="text-xs text-[#5C5852]">
              Watch each stage validate your request in real time. Click any completed stage box below to inspect its technical telemetry.
            </p>
          </div>
        </div>

        {totalLatencyMs ? (
          <div className="flex items-center gap-1.5 text-xs font-mono text-[#1C1B18] bg-[#F4F1EA] px-3 py-1.5 rounded-md border border-[#E5E0D8]">
            <Clock className="h-3.5 w-3.5 text-[#5C5852]" />
            <span>Total Time: {totalLatencyMs} ms</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {STAGE_META.map((meta) => {
          const step = stepMap.get(meta.key);
          const isExpanded = expandedKey === meta.key;

          let cardStyle =
            "border-[#E5E0D8] bg-[#FAF9F5] text-[#1C1B18] hover:bg-[#F4F1EA]";
          let badgeText = isLoading ? "RUNNING" : "IDLE";
          let badgeStyle =
            "bg-[#EAE6DC] text-[#5C5852] border border-[#D6D1C7]";

          if (isLoading && !step) {
            cardStyle =
              "border-[#CFC9BE] bg-[#F4F1EA] text-[#1C1B18] animate-pulse";
            badgeText = "ACTIVE";
            badgeStyle = "bg-[#1C1B18] text-white border border-[#1C1B18]";
          } else if (step) {
            if (step.status === "completed") {
              cardStyle =
                "border-[#C5E3CD] bg-[#F5FBF7] text-[#166534] hover:bg-[#EBF5EE]";
              badgeText = `${step.durationMs}ms`;
              badgeStyle =
                "bg-[#EBF5EE] text-[#166534] border border-[#9AD0A9]";
            } else if (step.status === "blocked" || step.status === "failed") {
              cardStyle =
                "border-rose-500/40 bg-[#FDF2F2] text-[#991B1B] hover:bg-[#FBE4E4] rose-500";
              badgeText = step.status.toUpperCase();
              badgeStyle =
                "bg-[#FBE4E4] text-rose-500 border border-[#F5C6C6]";
            } else if (step.status === "skipped") {
              cardStyle = "border-[#E5E0D8] bg-[#FAF9F5] text-[#8A857D]";
              badgeText = "SKIPPED";
              badgeStyle =
                "bg-[#EAE6DC] text-[#8A857D] border border-[#D6D1C7]";
            }
          }

          return (
            <button
              key={meta.key}
              type="button"
              disabled={!step}
              onClick={() => setExpandedKey(isExpanded ? null : meta.key)}
              className={`rounded-lg border p-3.5 text-left transition flex flex-col justify-between gap-2.5 ${cardStyle} ${
                isExpanded ? "ring-2 ring-[#1C1B18]" : ""
              }`}
            >
              <div className="space-y-1 w-full">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold truncate">
                    {meta.label}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${badgeStyle}`}
                  >
                    {badgeText}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[#5C5852] truncate">
                  {meta.role}
                </p>
              </div>

              <p className="text-[11px] leading-snug line-clamp-2 font-mono text-[#1C1B18]">
                {step
                  ? step.summary
                  : isLoading
                  ? "Executing node..."
                  : meta.plainTip}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expandable Stage Telemetry Drawer */}
      {expandedKey && stepMap.get(expandedKey) && (
        <div className="rounded-lg border border-[#E5E0D8] bg-[#F4F1EA] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-[#1C1B18] flex items-center gap-1.5">
              <CornerDownRight className="h-3.5 w-3.5 text-[#5C5852]" />
              <span>
                Stage Inspection: {stepMap.get(expandedKey)?.stage} (
                {stepMap.get(expandedKey)?.durationMs} ms)
              </span>
            </span>
            <button
              type="button"
              onClick={() => setExpandedKey(null)}
              className="px-2 py-1 rounded text-xs font-medium text-[#5C5852] hover:text-[#1C1B18] hover:bg-[#EAE6DC] transition flex items-center gap-1"
            >
              <span>Close</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="max-h-56 overflow-auto text-[11px] font-mono text-[#1C1B18] bg-white p-3 rounded border border-[#E5E0D8] leading-relaxed">
            {JSON.stringify(
              stepMap.get(expandedKey)?.details ?? {
                summary: stepMap.get(expandedKey)?.summary,
                status: stepMap.get(expandedKey)?.status,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </section>
  );
}
