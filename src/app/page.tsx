"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletHeader } from "@/components/wallet/WalletHeader";
import { ChatInterface, PRESET_SCENARIOS } from "@/components/ChatInterface";
import { AgentTimeline } from "@/components/AgentTimeline";
import { RiskCard } from "@/components/RiskCard";
import { ActionCard } from "@/components/ActionCard";
import { TokenScanner } from "@/components/TokenScanner";
import { AccountModal } from "@/components/wallet/AccountModal";
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
import {
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";

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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

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
    <div className="min-h-screen flex flex-col bg-[#080912] text-slate-100">
      <WalletHeader
        burner={burner}
        onSelectBurner={setBurner}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Pro Hero & Security Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-white/5 pb-6">
          <div className="space-y-2.5 max-w-3xl">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-300 text-xs font-semibold shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Solana Actions v2.2.1 · LangGraph Multi-Agent · Devnet Guardrails</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              AI Proposes.{" "}
              <span className="text-violet-400">
                Deterministic Guardrails Enforce.
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Autonomous intent copilot for Solana DeFi. Pre-flight RPC simulation, live Pyth oracle verification, atomic 2-of-2 Ed25519 co-signing, and cryptographic on-chain SPL Memo audit proofs.
            </p>
          </div>

          {/* Quick HUD Metrics */}
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <div className="px-3.5 py-2 rounded-2xl bg-[#101224]/80 border border-violet-500/20 space-y-0.5 shadow-sm">
              <span className="text-[10px] text-slate-400 block uppercase">Policy Enforcer</span>
              <span className="text-emerald-400 font-bold">Deterministic</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-[#101224]/80 border border-violet-500/20 space-y-0.5 shadow-sm">
              <span className="text-[10px] text-slate-400 block uppercase">Atomic Settlement</span>
              <span className="text-violet-300 font-bold">572 Bytes</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-[#101224]/80 border border-violet-500/20 space-y-0.5 shadow-sm">
              <span className="text-[10px] text-slate-400 block uppercase">On-Chain Memo</span>
              <span className="text-indigo-300 font-bold">SHA-256 Proof</span>
            </div>
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
              <div className="rounded-2xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs font-mono text-rose-300 shadow-md">
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
                      onOpenBurner={() => setIsAccountModalOpen(true)}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <TokenScanner />
        )}

        {/* Footer */}
        <footer className="mt-auto pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
          <div>
            AegisFlow v1.0 · MLH Solana Hackathon · Solana Devnet
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/actions.json"
              target="_blank"
              rel="noreferrer"
              className="hover:text-violet-400 transition"
            >
              /actions.json
            </a>
            <a
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noreferrer"
              className="hover:text-violet-400 transition"
            >
              Solana Explorer (Devnet) ↗
            </a>
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-violet-400 transition"
            >
              Devnet Faucet ↗
            </a>
          </div>
        </footer>
      </main>

      {/* Account / Wallet Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        burner={burner}
        onSelectBurner={setBurner}
      />
    </div>
  );
}
