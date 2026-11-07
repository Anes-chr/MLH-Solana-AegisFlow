"use client";

import React, { useState } from "react";
import type { TimelineStep, PipelineStageKey } from "@/lib/agent/graph";

export interface AgentTimelineProps {
  steps: TimelineStep[];
  isLoading: boolean;
  totalLatencyMs?: number | null;
}

const STAGE_META: Array<{
  key: PipelineStageKey;
  label: string;
  role: string;
}> = [
  { key: "planner", label: "1. Planner", role: "Zod Intent & Injection Filter" },
  { key: "scout", label: "2. Scout", role: "Live SOL/USD & Jupiter Quote" },
  { key: "builder", label: "3. Builder", role: "Deterministic Tx + Memo Hash" },
  { key: "sentinel", label: "4. Sentinel", role: "RPC Sim + 0–100 Policy Score" },
  { key: "gate", label: "5. Policy Gate", role: "Solana Action / Blink Minting" },
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>⛓️</span> 5-Stage LangGraph Sentinel Pipeline
          </h3>
          <p className="text-xs text-slate-400">
            Click any completed stage to inspect the structured LangGraph node state.
          </p>
        </div>
        {totalLatencyMs != null && !isLoading && (
          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-mono text-slate-300">
            End-to-End: {totalLatencyMs.toLocaleString()} ms
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {STAGE_META.map((meta) => {
          const step = stepMap.get(meta.key);
          const isExpanded = expandedKey === meta.key;

          let cardStyle = "border-slate-800 bg-slate-950/60 text-slate-400";
          let badgeText = isLoading ? "RUNNING" : "IDLE";
          let badgeStyle = "bg-slate-800 text-slate-400";

          if (isLoading && !step) {
            cardStyle =
              "border-indigo-500/40 bg-indigo-950/20 text-indigo-200 animate-pulse";
            badgeText = "ACTIVE";
            badgeStyle = "bg-indigo-500/20 text-indigo-300";
          } else if (step) {
            if (step.status === "completed") {
              cardStyle =
                "border-emerald-500/30 bg-emerald-950/15 text-slate-200 hover:border-emerald-500/60";
              badgeText = `${step.durationMs}ms`;
              badgeStyle = "bg-emerald-500/20 text-emerald-300";
            } else if (step.status === "blocked" || step.status === "failed") {
              cardStyle =
                "border-rose-500/40 bg-rose-950/25 text-rose-200 hover:border-rose-500/70";
              badgeText = step.status.toUpperCase();
              badgeStyle = "bg-rose-500/20 text-rose-300";
            } else if (step.status === "skipped") {
              cardStyle =
                "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700";
              badgeText = "SKIPPED";
              badgeStyle = "bg-slate-800 text-slate-400";
            }
          }

          return (
            <button
              key={meta.key}
              type="button"
              disabled={!step}
              onClick={() =>
                setExpandedKey(isExpanded ? null : meta.key)
              }
              className={`rounded-xl border p-3 text-left transition flex flex-col justify-between gap-2 ${cardStyle} ${
                isExpanded ? "ring-1 ring-indigo-400" : ""
              }`}
            >
              <div className="space-y-1 w-full">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white truncate">
                    {meta.label}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${badgeStyle}`}
                  >
                    {badgeText}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{meta.role}</p>
              </div>

              <p className="text-[11px] leading-snug line-clamp-2 text-slate-300">
                {step ? step.summary : isLoading ? "Executing node..." : "Awaiting prompt"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expandable Stage State Drawer */}
      {expandedKey && stepMap.get(expandedKey) && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-indigo-300">
              Stage Telemetry: {stepMap.get(expandedKey)?.stage} (
              {stepMap.get(expandedKey)?.durationMs} ms)
            </span>
            <button
              type="button"
              onClick={() => setExpandedKey(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close ✕
            </button>
          </div>
          <pre className="max-h-56 overflow-auto text-[11px] font-mono text-slate-300 leading-relaxed">
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
