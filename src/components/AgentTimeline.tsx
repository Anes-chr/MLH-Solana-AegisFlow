"use client";

import React, { useState } from "react";
import type { TimelineStep, PipelineStageKey } from "@/lib/agent/graph";
import { GitCommit, Clock, CheckCircle2, AlertOctagon, CornerDownRight, X, Sparkles } from "lucide-react";

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
  { key: "planner", label: "1. Planner", role: "Intent & Injection Filter" },
  { key: "scout", label: "2. Scout", role: "Pyth Oracle & Jupiter Spread" },
  { key: "builder", label: "3. Builder", role: "Atomic Tx & Memo Hash" },
  { key: "sentinel", label: "4. Sentinel", role: "RPC Simulation & Rules" },
  { key: "gate", label: "5. Policy Gate", role: "Solana Blink Minting" },
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
    <section className="obsidian-card rounded-3xl p-6 sm:p-7 space-y-4 border border-violet-500/15 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="icon-well shadow-inner">
            <GitCommit className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              5-Stage LangGraph Pipeline
            </h3>
            <p className="text-xs text-slate-400 font-normal">
              Autonomous multi-agent orchestration graph with deterministic gate verification.
            </p>
          </div>
        </div>
        {totalLatencyMs != null && !isLoading && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/25 text-xs font-mono text-violet-300">
            <Clock className="h-3 w-3 text-violet-400" />
            <span>Total: {totalLatencyMs.toLocaleString()} ms</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {STAGE_META.map((meta) => {
          const step = stepMap.get(meta.key);
          const isExpanded = expandedKey === meta.key;

          let cardStyle = "border-white/5 bg-[#101224]/80 text-slate-400 hover:border-violet-500/20";
          let badgeText = isLoading ? "RUNNING" : "IDLE";
          let badgeStyle = "bg-white/5 text-slate-400 border border-white/5";

          if (isLoading && !step) {
            cardStyle =
              "border-violet-500/40 bg-violet-500/10 text-violet-200 animate-pulse";
            badgeText = "ACTIVE";
            badgeStyle = "bg-violet-500/20 text-violet-300 border border-violet-500/30";
          } else if (step) {
            if (step.status === "completed") {
              cardStyle =
                "border-emerald-500/30 bg-emerald-500/5 text-slate-200 hover:border-emerald-500/60";
              badgeText = `${step.durationMs}ms`;
              badgeStyle = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
            } else if (step.status === "blocked" || step.status === "failed") {
              cardStyle =
                "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-500/70";
              badgeText = step.status.toUpperCase();
              badgeStyle = "bg-rose-500/20 text-rose-300 border border-rose-500/30";
            } else if (step.status === "skipped") {
              cardStyle =
                "border-white/5 bg-black/20 text-slate-500";
              badgeText = "SKIPPED";
              badgeStyle = "bg-white/5 text-slate-500 border border-white/5";
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
              className={`rounded-2xl border p-3.5 text-left transition flex flex-col justify-between gap-2.5 ${cardStyle} ${
                isExpanded ? "ring-2 ring-violet-500 border-violet-400" : ""
              }`}
            >
              <div className="space-y-1 w-full">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white truncate">
                    {meta.label}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${badgeStyle}`}
                  >
                    {badgeText}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{meta.role}</p>
              </div>

              <p className="text-[11px] leading-snug line-clamp-2 text-slate-300 font-mono">
                {step ? step.summary : isLoading ? "Executing node..." : "Awaiting input"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expandable Stage Telemetry Modal/Drawer */}
      {expandedKey && stepMap.get(expandedKey) && (
        <div className="rounded-2xl border border-violet-500/25 bg-[#0C0D1A]/95 p-4 space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-violet-300 flex items-center gap-1.5">
              <CornerDownRight className="h-3.5 w-3.5 text-violet-400" />
              <span>Node Telemetry: {stepMap.get(expandedKey)?.stage} ({stepMap.get(expandedKey)?.durationMs} ms)</span>
            </span>
            <button
              type="button"
              onClick={() => setExpandedKey(null)}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <pre className="max-h-56 overflow-auto text-[11px] font-mono text-slate-300 bg-black/50 p-3 rounded-xl border border-white/5 leading-relaxed">
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
