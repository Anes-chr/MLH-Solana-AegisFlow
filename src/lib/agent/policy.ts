import {
  ALLOWED_PROGRAM_IDS,
  KNOWN_DRAINER_ADDRESSES,
  TOKEN_CONFIG,
} from '../solana/config';

export type RiskBand = 'safe' | 'caution' | 'blocked';

export interface PolicyFinding {
  id: string;
  check: string;
  passed: boolean;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  penalty: number;
  detail: string;
}

export interface PolicyEvaluationInput {
  simOk: boolean;
  simErr?: unknown;
  programs: string[];
  amountSol: number;
  expectedDUsdc?: number;
  pythPriceUsd?: number;
  pythConfidence?: number;
  pythPublishTime?: number;
  maxSlippageBps?: number | null;
  destination?: string | null;
  senderPubkey?: string | null;
  promptText: string;
  isUnsafeOrInjection?: boolean;
  spendingCapSol?: number;
  unitsConsumed?: number;
}

export interface PolicyEvaluationResult {
  score: number;
  band: RiskBand;
  approved: boolean;
  findings: PolicyFinding[];
  refusalReason: string | null;
}

const INJECTION_REGEX_LIST: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'system_override',
    pattern: /\b(system\s+(override|update|prompt)|override\s+(all|rules|safety|policy))\b/i,
  },
  {
    label: 'ignore_instructions',
    pattern: /\bignore\s+(all\s+)?(previous|prior|your|earlier|safety)?\s*(instructions|rules|guardrails|constraints|prompts)\b/i,
  },
  {
    label: 'bypass_guardrails',
    pattern: /\b(bypass|disable|turn\s+off|ignore)\s+(all\s+)?(guardrails|security|policy|sentinel|checks)\b/i,
  },
  {
    label: 'jailbreak_roleplay',
    pattern: /\b(pretend\s+you\s+are|you\s+are\s+now\s+dan|dan\s+mode|jailbreak|unrestricted\s+withdrawal)\b/i,
  },
  {
    label: 'drain_wallet',
    pattern: /\b(drain\s+(all|my|the|vault)|sweep\s+all\s+funds|transfer\s+all\s+(\d+(\.\d+)?\s*)?(sol|funds|everything)|send\s+everything)\b/i,
  },
  {
    label: 'multilingual_override',
    pattern: /(ignora\s+todas\s+las\s+reglas|ignora\s+las\s+instrucciones|oublie\s+toutes\s+les\s+r[eè]gles|ignorez\s+les\s+instructions)/i,
  },
  {
    label: 'script_or_sql_payload',
    pattern: /(<\s*script\b|drop\s+table\b|;\s*--\s*$|execute\s*:\s*[A-Za-z0-9+/]{12,}={0,2})/i,
  },
];

export function detectPromptInjection(promptText: string): {
  detected: boolean;
  matchedSignals: string[];
} {
  const matchedSignals: string[] = [];
  for (const rule of INJECTION_REGEX_LIST) {
    if (rule.pattern.test(promptText)) {
      matchedSignals.push(rule.label);
    }
  }
  return {
    detected: matchedSignals.length > 0,
    matchedSignals,
  };
}

export function getRiskBand(score: number): RiskBand {
  if (score < 20) return 'safe';
  if (score < 50) return 'caution';
  return 'blocked';
}

/**
 * Deterministic pre-flight risk scoring engine (0-100).
 * Pure TypeScript evaluation: LLM output CANNOT alter or override this score.
 * Score >= 50 strictly blocks Action/Blink generation.
 */
export function evaluatePolicyRules(
  input: PolicyEvaluationInput
): PolicyEvaluationResult {
  const findings: PolicyFinding[] = [];
  let totalPenalty = 0;

  // 1. Pre-Flight Simulation Check
  if (!input.simOk || (input.simErr !== undefined && input.simErr !== null)) {
    totalPenalty += 100;
    const errDetail =
      input.simErr != null ? JSON.stringify(input.simErr) : 'Simulation returned ok=false';
    findings.push({
      id: 'SIM_CHECK',
      check: 'Pre-Flight RPC Simulation',
      passed: false,
      severity: 'critical',
      penalty: 100,
      detail: `Simulation failed before signing: ${errDetail}`,
    });
  } else {
    findings.push({
      id: 'SIM_CHECK',
      check: 'Pre-Flight RPC Simulation',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: 'Transaction simulated cleanly on Solana Devnet without execution errors.',
    });
  }

  // 2. Program Allow-List Check ({System, Token, ATA, Memo, ComputeBudget})
  const unauthorizedPrograms = (input.programs ?? []).filter(
    (prog) => !ALLOWED_PROGRAM_IDS.has(prog)
  );
  if (unauthorizedPrograms.length > 0) {
    totalPenalty += 60;
    findings.push({
      id: 'PROGRAM_ALLOWLIST',
      check: 'Program Allow-List',
      passed: false,
      severity: 'critical',
      penalty: 60,
      detail: `Unauthorized program(s) invoked outside allow-list: ${unauthorizedPrograms.join(', ')}`,
    });
  } else {
    findings.push({
      id: 'PROGRAM_ALLOWLIST',
      check: 'Program Allow-List',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: `All ${input.programs?.length || 0} program(s) verified against {System, Token, ATA, Memo, ComputeBudget}.`,
    });
  }

  // 3. Spending Cap & Positive Amount Check
  const cap = input.spendingCapSol ?? TOKEN_CONFIG.MAX_SOL_SWAP_DEVNET;
  if (!Number.isFinite(input.amountSol) || input.amountSol <= 0) {
    totalPenalty += 100;
    findings.push({
      id: 'SPENDING_CAP',
      check: 'Spending Cap & Amount Bounds',
      passed: false,
      severity: 'critical',
      penalty: 100,
      detail: `Invalid transaction amount (${input.amountSol} SOL). Amount must be positive.`,
    });
  } else if (input.amountSol > cap) {
    totalPenalty += 55;
    findings.push({
      id: 'SPENDING_CAP',
      check: 'Spending Cap',
      passed: false,
      severity: 'high',
      penalty: 55,
      detail: `Outflow of ${input.amountSol} SOL exceeds policy spending cap of ${cap.toFixed(2)} SOL.`,
    });
  } else {
    findings.push({
      id: 'SPENDING_CAP',
      check: 'Spending Cap',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: `Outflow of ${input.amountSol} SOL is within ${cap.toFixed(2)} SOL policy cap.`,
    });
  }

  // 4. Oracle Price Sanity & Slippage Bounds
  let oraclePenalty = 0;
  const oracleNotes: string[] = [];

  if (input.maxSlippageBps != null) {
    if (input.maxSlippageBps < 0 || input.maxSlippageBps > 1000) {
      oraclePenalty += 55;
      oracleNotes.push(
        `Requested slippage (${input.maxSlippageBps} bps) exceeds 1000 bps (10%) safety ceiling.`
      );
    } else if (input.maxSlippageBps > 300) {
      oraclePenalty += 25;
      oracleNotes.push(
        `Elevated slippage tolerance (${input.maxSlippageBps} bps > 300 bps standard caution threshold).`
      );
    }
  }

  if (input.pythPriceUsd && input.pythPriceUsd > 0) {
    if (
      input.pythConfidence != null &&
      input.pythConfidence / input.pythPriceUsd > 0.05
    ) {
      oraclePenalty += 30;
      oracleNotes.push(
        `Pyth confidence interval ($${input.pythConfidence.toFixed(2)}) exceeds 5% of spot price.`
      );
    }

    if (input.pythPublishTime != null) {
      const ageSec = Math.floor(Date.now() / 1000) - input.pythPublishTime;
      if (ageSec > 300) {
        oraclePenalty += 25;
        oracleNotes.push(`Pyth oracle publish timestamp is stale (${ageSec}s > 300s).`);
      }
    }

    if (input.expectedDUsdc != null && input.amountSol > 0) {
      const impliedRate = input.expectedDUsdc / input.amountSol;
      const deviationRatio = Math.abs(impliedRate - input.pythPriceUsd) / input.pythPriceUsd;
      if (deviationRatio > 0.02) {
        oraclePenalty += 30;
        oracleNotes.push(
          `Execution price ($${impliedRate.toFixed(2)}) deviates ${(deviationRatio * 100).toFixed(2)}% from Pyth oracle ($${input.pythPriceUsd.toFixed(2)}).`
        );
      }
    }
  }

  if (oraclePenalty > 0) {
    totalPenalty += oraclePenalty;
    findings.push({
      id: 'PRICE_SANITY',
      check: 'Oracle & Slippage Sanity',
      passed: false,
      severity: oraclePenalty >= 50 ? 'high' : 'medium',
      penalty: oraclePenalty,
      detail: oracleNotes.join(' '),
    });
  } else {
    findings.push({
      id: 'PRICE_SANITY',
      check: 'Oracle & Slippage Sanity',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: input.pythPriceUsd
        ? `Swap priced against Pyth SOL/USD ($${input.pythPriceUsd.toFixed(2)}) within tight confidence bounds.`
        : 'Slippage and pricing parameters within safe bounds.',
    });
  }

  // 5. Destination / Blocklist Check
  if (input.destination) {
    const destTrimmed = input.destination.trim();
    if (KNOWN_DRAINER_ADDRESSES.has(destTrimmed)) {
      totalPenalty += 100;
      findings.push({
        id: 'DESTINATION_CHECK',
        check: 'Destination Blocklist',
        passed: false,
        severity: 'critical',
        penalty: 100,
        detail: `Destination ${destTrimmed} matches known malicious drainer blocklist.`,
      });
    } else if (input.senderPubkey && destTrimmed === input.senderPubkey.trim()) {
      totalPenalty += 25;
      findings.push({
        id: 'DESTINATION_CHECK',
        check: 'Destination Verification',
        passed: false,
        severity: 'medium',
        penalty: 25,
        detail: 'Self-transfer warning: recipient address matches sender wallet.',
      });
    } else {
      findings.push({
        id: 'DESTINATION_CHECK',
        check: 'Destination Blocklist',
        passed: true,
        severity: 'info',
        penalty: 0,
        detail: `Recipient ${destTrimmed.slice(0, 6)}...${destTrimmed.slice(-4)} cleared against blocklist.`,
      });
    }
  } else {
    findings.push({
      id: 'DESTINATION_CHECK',
      check: 'Vault Counterparty Verification',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: 'Counterparty restricted to verified AegisFlow Devnet Vault.',
    });
  }

  // 6. Prompt-Injection & Override Signal Check
  const injectionScan = detectPromptInjection(input.promptText || '');
  if (input.isUnsafeOrInjection || injectionScan.detected) {
    const signals = injectionScan.matchedSignals.length > 0
      ? injectionScan.matchedSignals.join(', ')
      : 'llm_unsafe_flag';
    totalPenalty += 65;
    findings.push({
      id: 'INJECTION_CHECK',
      check: 'Prompt Injection Guard',
      passed: false,
      severity: 'critical',
      penalty: 65,
      detail: `Blocked adversarial override/injection signal (${signals}).`,
    });
  } else {
    findings.push({
      id: 'INJECTION_CHECK',
      check: 'Prompt Injection Guard',
      passed: true,
      severity: 'info',
      penalty: 0,
      detail: 'No prompt-injection or instruction-override patterns detected.',
    });
  }

  // 7. Excessive Compute Units Check
  if (input.unitsConsumed != null && input.unitsConsumed > 1_200_000) {
    totalPenalty += 25;
    findings.push({
      id: 'COMPUTE_BUDGET',
      check: 'Compute Unit Bounds',
      passed: false,
      severity: 'medium',
      penalty: 25,
      detail: `High compute unit consumption (${input.unitsConsumed.toLocaleString()} CU > 1,200,000 CU).`,
    });
  }

  const score = Math.max(0, Math.min(100, totalPenalty));
  const band = getRiskBand(score);
  const approved = score < 50;

  const failedDetails = findings.filter((f) => !f.passed).map((f) => f.detail);
  const refusalReason = approved
    ? null
    : `Transaction blocked (Risk Score ${score}/100): ${
        failedDetails.join(' | ') || 'Policy threshold exceeded.'
      }`;

  return {
    score,
    band,
    approved,
    findings,
    refusalReason,
  };
}
