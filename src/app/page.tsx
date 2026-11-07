"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletHeader } from "@/components/wallet/WalletHeader";
import { ChatInterface, PRESET_SCENARIOS } from "@/components/ChatInterface";
import { AgentTimeline } from "@/components/AgentTimeline";
import { RiskCard } from "@/components/RiskCard";
import { ActionCard } from "@/components/ActionCard";
import { TokenScanner } from "@/components/TokenScanner";
import { BurnerWalletModal } from "@/components/BurnerWalletModal";
import {
  type BurnerWalletState,
  loadExistingBurnerWallet,
} from "@/lib/solana/burner";
import type {
  AgentPlanSummary,
  AgentRiskSummary,
  PortfolioSnapshot,
  TimelineStep,
} from "@/lib/agent/graph";
import type { DeFiIntent } from "@/lib/agent/schema";
import type { PythPriceData } from "@/lib/solana/pyth";
import type { JupiterReferenceQuote } from "@/lib/solana/jupiter";
import type { SimulationResult } from "@/lib/solana/simulation";

interface AgentApiResponse {
  status: "approved" | "caution" | "blocked" | "readonly" | "unsupported";
  intent: DeFiIntent | null;
  market: PythPriceData | null;
  jupiterQuote: JupiterReferenceQuote | null;
  portfolio: PortfolioSnapshot | null;
  plan: AgentPlanSummary | null;
  sim: SimulationResult | null;
  risk: AgentRiskSummary | null;
  actionUrl: string | null;
  blinkUrl: string | null;
  timeline: TimelineStep[];
  latencyMs?: number;
  error?: string;
}

export default function Home() {
  const { connected, publicKey } = useWallet();

  const [activeTab, setActiveTab] = useState<"copilot" | "scanner">("copilot");
  const [prompt, setPrompt] = useState(PRESET_SCENARIOS[0].prompt);
  const [spendingCapSol, setSpendingCapSol] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [agentState, setAgentState] = useState<AgentApiResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [burner, setBurner] = useState<BurnerWalletState | null>(null);
  const [isBurnerModalOpen, setIsBurnerModalOpen] = useState(false);

  useEffect(() => {
    const existing = loadExistingBurnerWallet();
    if (existing) {
      setBurner(existing);
    }
  }, []);

  const activeWalletPubkey =
    connected && publicKey
      ? publicKey.toBase58()
      : burner?.pubkey ?? undefined;

  const handleRunAgent = async (overridePrompt?: string) => {
    const textToRun = (overridePrompt ?? prompt).trim();
    if (!textToRun || isLoading) return;

    setIsLoading(true);
    setRequestError(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToRun,
          walletPubkey: activeWalletPubkey,
          spendingCapSol,
        }),
      });
      const data = (await res.json()) as AgentApiResponse;
      if (!res.ok) {
        setRequestError(data.error || `Agent API returned HTTP ${res.status}`);
      } else {
        setAgentState(data);
      }
    } catch {
      setRequestError(
        "Failed to reach /api/agent. Ensure the Next.js server is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <WalletHeader
        burnerPubkey={burner?.pubkey ?? null}
        onOpenBurner={() => setIsBurnerModalOpen(true)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-7">
        {/* Compact Hero Banner */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-900 pb-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Solana Devnet · LangGraph 5-Stage Sentinel · Solana Actions v2.2.1
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              AegisFlow:{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                AI DeFi Copilot with Pre-Flight Guardrails
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Natural language plans are simulated on Solana Devnet, scored by a deterministic 6-rule TypeScript policy engine, anchored on-chain via SPL Memo SHA-256, and minted into shareable Solana Blinks only when safe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBurnerModalOpen(true)}
              className="rounded-xl border border-slate-800 bg-slate-900/90 hover:border-amber-500/40 px-3.5 py-2 text-xs font-semibold text-slate-200 transition"
            >
              {burner
                ? `🔥 Active Burner: ${burner.pubkey.slice(0, 6)}...${burner.pubkey.slice(-4)}`
                : "🔥 Launch 1-Click Judge Burner Wallet"}
            </button>
          </div>
        </div>

        {activeTab === "copilot" ? (
          <>
            <ChatInterface
              prompt={prompt}
              onPromptChange={setPrompt}
              spendingCapSol={spendingCapSol}
              onSpendingCapChange={setSpendingCapSol}
              isLoading={isLoading}
              onSubmit={handleRunAgent}
            />

            {(isLoading || agentState) && (
              <AgentTimeline
                steps={agentState?.timeline ?? []}
                isLoading={isLoading}
                totalLatencyMs={agentState?.latencyMs ?? null}
              />
            )}

            {requestError && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200">
                <strong>Pipeline Error:</strong> {requestError}
              </div>
            )}

            {agentState && !isLoading && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div
                  className={
                    agentState.actionUrl || agentState.status === "blocked"
                      ? "lg:col-span-7"
                      : "lg:col-span-12"
                  }
                >
                  <RiskCard
                    status={agentState.status}
                    risk={agentState.risk}
                    sim={agentState.sim}
                    plan={agentState.plan}
                    market={agentState.market}
                    jupiterQuote={agentState.jupiterQuote}
                    portfolio={agentState.portfolio}
                    warnings={agentState.intent?.warnings}
                  />
                </div>

                {(agentState.actionUrl || agentState.status === "blocked") && (
                  <div className="lg:col-span-5">
                    <ActionCard
                      actionUrl={agentState.actionUrl}
                      blinkUrl={agentState.blinkUrl}
                      riskScore={agentState.risk?.score ?? null}
                      status={agentState.status}
                      burner={burner}
                      onOpenBurner={() => setIsBurnerModalOpen(true)}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <TokenScanner />
        )}

        {/* Transparent Devnet Architecture Footer */}
        <footer className="mt-auto pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>
            AegisFlow · Built on Solana Devnet (`@solana/web3.js` 1.99.0 + `@solana/actions` + LangGraph.js)
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/actions.json"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition font-mono"
            >
              /actions.json
            </a>
            <a
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition"
            >
              Solana Explorer (Devnet)
            </a>
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition"
            >
              Devnet Faucet
            </a>
          </div>
        </footer>
      </main>

      <BurnerWalletModal
        isOpen={isBurnerModalOpen}
        onClose={() => setIsBurnerModalOpen(false)}
        burner={burner}
        onBurnerChange={setBurner}
      />
    </div>
  );
}
