"use client";

import React, { useState } from "react";
import type { TimelineStep, PipelineStageKey } from "@/lib/agent/graph";
import { GitCommit, Clock, CornerDownRight, X } from "lucide-react";

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
    <section className="obsidian-card p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7E4DC] pb-3.5">
        <div className="flex items-center gap-3">
          <div className="icon-well">
            <GitCommit className="h-4 w-4 text-[#1C1B1A]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1C1B1A]">
              5-Stage Multi-Agent Orchestration Pipeline
            </h3>
            <p className="text-xs text-[#66635D]">
              LangGraph state machine with deterministic security gates.
            </p>
          </div>
        </div>
        {totalLatencyMs != null && !isLoading && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F3F1EC] border border-[#E7E4DC] text-xs font-mono text-[#4A4742]">
            <Clock className="h-3 w-3 text-[#66635D]" />
            <span>Total: {totalLatencyMs.toLocaleString()} ms</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {STAGE_META.map((meta) => {
          const step = stepMap.get(meta.key);
          const isExpanded = expandedKey === meta.key;

          let cardStyle = "border-[#E7E4DC] bg-[#F8F7F4] text-[#1C1B1A] hover:bg-[#F3F1EC]";
          let badgeText = isLoading ? "RUNNING" : "IDLE";
          let badgeStyle = "bg-[#EAE6DE] text-[#66635D] border border-[#DDD9CE]";

          if (isLoading && !step) {
            cardStyle =
              "border-[#CDC9BD] bg-[#F3F1EC] text-[#1C1B1A] animate-pulse";
            badgeText = "ACTIVE";
            badgeStyle = "bg-[#1C1B1A] text-white border border-[#1C1B1A]";
          } else if (step) {
            if (step.status === "completed") {
              cardStyle =
                "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] hover:bg-[#DCFCE7]";
              badgeText = `${step.durationMs}ms`;
              badgeStyle = "bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]";
            } else if (step.status === "blocked" || step.status === "failed") {
              cardStyle =
                "border-rose-500/40 bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2] rose-500";
              badgeText = step.status.toUpperCase();
              badgeStyle = "bg-[#FEE2E2] text-rose-500 border border-[#FCA5A5]";
            } else if (step.status === "skipped") {
              cardStyle =
                "border-[#E7E4DC] bg-[#F8F7F4] text-[#8C8880]";
              badgeText = "SKIPPED";
              badgeStyle = "bg-[#EAE6DE] text-[#8C8880] border border-[#DDD9CE]";
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
              className={`rounded-lg border p-3 text-left transition flex flex-col justify-between gap-2 ${cardStyle} ${
                isExpanded ? "ring-2 ring-[#1C1B1A]" : ""
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
                <p className="text-[11px] text-[#66635D] truncate">{meta.role}</p>
              </div>

              <p className="text-[11px] leading-snug line-clamp-2 font-mono text-[#4A4742]">
                {step ? step.summary : isLoading ? "Executing node..." : "Awaiting input"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expandable Stage Telemetry Modal/Drawer */}
      {expandedKey && stepMap.get(expandedKey) && (
        <div className="rounded-lg border border-[#E7E4DC] bg-[#F8F7F4] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-[#1C1B1A] flex items-center gap-1.5">
              <CornerDownRight className="h-3.5 w-3.5 text-[#66635D]" />
              <span>Node Telemetry: {stepMap.get(expandedKey)?.stage} ({stepMap.get(expandedKey)?.durationMs} ms)</span>
            </span>
            <button
              type="button"
              onClick={() => setExpandedKey(null)}
              className="p-1 rounded text-[#66635D] hover:text-[#1C1B1A] hover:bg-[#EBE8E1] transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="max-h-56 overflow-auto text-[11px] font-mono text-[#1C1B1A] bg-white p-2.5 rounded border border-[#E7E4DC] leading-relaxed">
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
