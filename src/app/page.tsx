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
  Shield,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle2,
  Lock,
  ArrowRight,
  Code2,
  FileCheck,
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

  const [activeTab, setActiveTab] = useState<
    "copilot" | "sentinel" | "scanner" | "docs"
  >("copilot");
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
    <div className="min-h-screen flex flex-col bg-[#FBFBFA] text-[#1C1B1A]">
      <WalletHeader
        burner={burner}
        onSelectBurner={setBurner}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Simple Non-Specialist Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E7E4DC] pb-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F3F1EC] text-[#66635D] border border-[#E7E4DC]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1B6635]" />
              <span>Solana Actions v2.2.1 · LangGraph Multi-Agent · Devnet Active</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1B1A]">
              Autonomous DeFi Intent Copilot with Pre-Flight Guardrails
            </h1>
            <p className="text-xs sm:text-sm text-[#66635D] leading-relaxed">
              Express your trading intent in natural language. Deterministic security guardrails simulate on-chain transactions, verify Pyth oracle prices, and guard against prompt injection before you sign.
            </p>
          </div>

          {/* Quick HUD Metrics */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs shrink-0">
            <div className="px-3 py-2 rounded-md bg-white border border-[#E7E4DC] space-y-0.5">
              <span className="text-[10px] text-[#8C887F] block uppercase font-semibold">Guardrail Gate</span>
              <span className="text-[#1B6635] font-bold">Deterministic</span>
            </div>
            <div className="px-3 py-2 rounded-md bg-white border border-[#E7E4DC] space-y-0.5">
              <span className="text-[10px] text-[#8C887F] block uppercase font-semibold">Atomic Swap</span>
              <span className="text-[#1C1B1A] font-bold">572 Bytes</span>
            </div>
            <div className="px-3 py-2 rounded-md bg-white border border-[#E7E4DC] space-y-0.5">
              <span className="text-[10px] text-[#8C887F] block uppercase font-semibold">On-Chain Audit</span>
              <span className="text-[#1C1B1A] font-bold">SHA-256 Memo</span>
            </div>
          </div>
        </div>

        {/* Tab 1: Copilot View */}
        {activeTab === "copilot" && (
          <div className="space-y-6">
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
              <div className="rounded-md border border-[#F0CDCD] bg-[#FDF4F4] p-4 text-xs font-mono text-[#8C2323]">
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
                  
                  <div className="mt-3 flex items-center justify-between p-3 rounded-md bg-white border border-[#E7E4DC] text-xs font-mono">
                    <span className="text-[#66635D]">Need deep on-chain simulation or CU breakdown?</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("sentinel")}
                      className="text-[#1C1B1A] font-semibold hover:underline flex items-center gap-1"
                    >
                      <span>Open Sentinel Cockpit</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
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
          </div>
        )}

        {/* Tab 2: Sentinel Cockpit View */}
        {activeTab === "sentinel" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E7E4DC] rounded-lg p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E7E4DC] pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-[#F3F1EC] border border-[#DDD9CE] flex items-center justify-center text-[#1C1B1A]">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#1C1B1A]">
                      Pre-Flight Sentinel Cockpit
                    </h2>
                    <p className="text-xs text-[#66635D]">
                      Deterministic security engine monitoring Pyth price feeds, simulation balance deltas, and compute units.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-mono bg-[#EBF4EE] text-[#1B6635] border border-[#CDE8D5] font-medium">
                  Gate Enforced
                </span>
              </div>

              {agentState ? (
                <div className="space-y-6 pt-2">
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

                  {agentState.timeline && (
                    <AgentTimeline
                      steps={agentState.timeline}
                      isLoading={false}
                      totalLatencyMs={agentState.latencyMs ?? null}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-4 py-4 text-xs">
                  <p className="text-[#66635D] leading-relaxed">
                    No active transaction evaluated yet. Run a prompt in the <strong>Copilot</strong> tab to inspect live pre-flight simulation, Pyth vs Jupiter reference pricing, and on-chain memo proofs.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3.5 rounded-md border border-[#E7E4DC] bg-[#F8F7F4] space-y-1">
                      <span className="font-semibold text-[#1C1B1A] block">1. Pyth Oracle Guard</span>
                      <p className="text-[#66635D]">Verifies live devnet SOL/USD price. Flags price discrepancy &gt;2% vs DEX reference.</p>
                    </div>
                    <div className="p-3.5 rounded-md border border-[#E7E4DC] bg-[#F8F7F4] space-y-1">
                      <span className="font-semibold text-[#1C1B1A] block">2. RPC Simulation</span>
                      <p className="text-[#66635D]">Runs preflight on Solana Devnet RPC. Asserts net token deltas and compute budget &lt;100k CU.</p>
                    </div>
                    <div className="p-3.5 rounded-md border border-[#E7E4DC] bg-[#F8F7F4] space-y-1">
                      <span className="font-semibold text-[#1C1B1A] block">3. Cryptographic Memo</span>
                      <p className="text-[#66635D]">Anchors SHA-256 hash of the execution plan into an on-chain SPL Memo instruction.</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("copilot");
                        handleRunAgent(PRESET_SCENARIOS[0].prompt);
                      }}
                      className="px-4 py-2 bg-[#1C1B1A] text-white hover:bg-[#33312E] rounded-md font-medium text-xs transition"
                    >
                      Run Safe Swap Simulation in Copilot →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Token Auditor View */}
        {activeTab === "scanner" && (
          <TokenScanner />
        )}

        {/* Tab 4: Architecture & Proofs View */}
        {activeTab === "docs" && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E7E4DC] rounded-lg p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E7E4DC] pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-[#F3F1EC] border border-[#DDD9CE] flex items-center justify-center text-[#1C1B1A]">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-[#1C1B1A]">
                      Architecture &amp; Security Proofs
                    </h2>
                    <p className="text-xs text-[#66635D]">
                      Technical design specifications, non-custodial boundaries, and automated test proofs.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-mono bg-[#EBF4EE] text-[#1B6635] border border-[#CDE8D5] font-medium">
                  254/254 Tests Passing
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                <div className="p-4 rounded-md border border-[#E7E4DC] bg-[#F8F7F4] space-y-2">
                  <h3 className="font-bold text-[#1C1B1A] flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Non-Custodial Multi-Agent Architecture</span>
                  </h3>
                  <p className="text-[#66635D]">
                    The LLM (Gemini 2.5 Flash) only interprets natural language into structured JSON intents. It never generates raw bytecode or holds private keys. The deterministic LangGraph pipeline validates spending limits, simulates execution on Solana Devnet RPC, and constructs signed transactions.
                  </p>
                </div>

                <div className="p-4 rounded-md border border-[#E7E4DC] bg-[#F8F7F4] space-y-2">
                  <h3 className="font-bold text-[#1C1B1A] flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    <span>Solana Actions &amp; Blinks Specification (v2.2.1)</span>
                  </h3>
                  <p className="text-[#66635D]">
                    Approved plans generate compliant Solana Action endpoints with CORS headers, GET metadata, and POST endpoints delivering partially-signed wire transactions. Users can execute them in-app or share across Twitter/X and messaging apps via Dial.to.
                  </p>
                </div>

                <div className="p-4 rounded-md border border-[#E7E4DC] bg-[#F8F7F4] space-y-2">
                  <h3 className="font-bold text-[#1C1B1A] flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>2-of-2 Ed25519 Atomic Settlement</span>
                  </h3>
                  <p className="text-[#66635D]">
                    Swaps execute atomically: User SOL transfers to Aegis Vault, and Aegis Vault transfers dUSDC tokens to User Associated Token Account in a single transaction. Both parties must co-sign. If either leg fails, the entire transaction reverts.
                  </p>
                </div>

                <div className="p-4 rounded-md border border-[#E7E4DC] bg-[#F8F7F4] space-y-2">
                  <h3 className="font-bold text-[#1C1B1A] flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5" />
                    <span>On-Chain Cryptographic Memo Proofs</span>
                  </h3>
                  <p className="text-[#66635D]">
                    Every approved plan includes an SPL Memo instruction containing <code className="bg-white px-1 py-0.5 rounded border border-[#E7E4DC] text-[#1C1B1A]">aegis:v1:&lt;sha256&gt;</code>. This binds the intent, simulated slippage, and timestamp immutably on the Solana blockchain for auditability.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-md border border-[#E7E4DC] bg-white space-y-2">
                <span className="font-bold text-xs text-[#1C1B1A] block">
                  Automated Verification Test Suite:
                </span>
                <p className="text-xs text-[#66635D]">
                  AegisFlow runs a 4-tier automated test suite covering 254 test cases across Solana RPC features, boundary conditions, adversarial prompt injections, and end-to-end integration flows.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-[#F8F7F4] border border-[#E7E4DC] text-[#1C1B1A]">Tier 1 Features: 94 passing</span>
                  <span className="px-2 py-0.5 rounded bg-[#F8F7F4] border border-[#E7E4DC] text-[#1C1B1A]">Tier 2 Boundaries: 112 passing</span>
                  <span className="px-2 py-0.5 rounded bg-[#F8F7F4] border border-[#E7E4DC] text-[#1C1B1A]">Tier 3 Pairwise: 32 passing</span>
                  <span className="px-2 py-0.5 rounded bg-[#F8F7F4] border border-[#E7E4DC] text-[#1C1B1A]">Tier 4 Scenarios: 16 passing</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-auto pt-6 border-t border-[#E7E4DC] flex flex-col sm:flex-row items-center justify-between text-xs text-[#8C887F] font-mono gap-4">
          <div>
            AegisFlow v1.0 · MLH Solana Hackathon · Solana Devnet
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/actions.json"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#1C1B1A] transition"
            >
              /actions.json
            </a>
            <a
              href="https://explorer.solana.com/?cluster=devnet"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#1C1B1A] transition"
            >
              Solana Explorer (Devnet) ↗
            </a>
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#1C1B1A] transition"
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
