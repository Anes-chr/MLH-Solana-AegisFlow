import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { PolicyFinding, RiskBand } from './policy';

export interface SentinelPromptInput {
  intentKind: string;
  amountSol: number;
  expectedDUsdc?: number;
  destination?: string | null;
  solDeltaUser: number;
  dUsdcDeltaUser: number;
  unitsConsumed: number;
  feeSol: number;
  planSha256?: string | null;
  riskScore: number;
  riskBand: RiskBand;
  findings: PolicyFinding[];
}

export const SENTINEL_SYSTEM_PROMPT = `You are AegisFlow Sentinel, a security-first Solana transaction explainer.
Explain the pre-flight simulation findings in 3-5 plain-English bullets (each starting with "• ").
Strict rules:
1. Keep total output under 150 words. No HTML tags, no markdown headers.
2. You CANNOT change, dispute, or override the deterministic risk score provided to you.
3. Explicitly cite the exact net SOL balance change and token inflow (if any), compute units, and fee.
4. Never reassure the user if riskScore >= 50; clearly state that the transaction is blocked and explain every failed security check.`;

/**
 * Strips HTML tags and normalizes bullet formatting to prevent XSS and layout breakage.
 */
export function sanitizeExplanationText(raw: string): string {
  const withoutHtml = raw.replace(/<[^>]*>?/gm, '').trim();
  const words = withoutHtml.split(/\s+/);
  if (words.length > 150) {
    return words.slice(0, 150).join(' ') + '...';
  }
  return withoutHtml;
}

/**
 * Formats deterministic simulation metrics and policy findings into the Sentinel user prompt.
 */
export function buildSentinelPrompt(input: SentinelPromptInput): string {
  const failedChecks = input.findings.filter((f) => !f.passed);
  const passedChecks = input.findings.filter((f) => f.passed);

  const findingsSummary =
    failedChecks.length > 0
      ? failedChecks.map((f) => `- [FAILED +${f.penalty}] ${f.check}: ${f.detail}`).join('\n')
      : passedChecks.map((f) => `- [PASSED] ${f.check}: ${f.detail}`).join('\n');

  return [
    `Action Type: ${input.intentKind}`,
    `Deterministic Risk Score: ${input.riskScore}/100 (${input.riskBand.toUpperCase()}) — IMMUTABLE`,
    `Net User SOL Delta: ${input.solDeltaUser} SOL (incl. ~${input.feeSol} SOL network fee)`,
    `Net User dUSDC Delta: ${input.dUsdcDeltaUser >= 0 ? '+' : ''}${input.dUsdcDeltaUser} dUSDC`,
    input.destination ? `Destination: ${input.destination}` : 'Counterparty: AegisFlow Devnet Vault',
    `Compute Units Consumed: ${input.unitsConsumed} CU`,
    input.planSha256 ? `On-Chain Memo Plan Anchor: aegis:v1:${input.planSha256.slice(0, 12)}...` : '',
    `Policy Findings:\n${findingsSummary}`,
    `\nWrite 3-5 plain-English bullets summarizing what happens and why the score is ${input.riskScore}/100.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Deterministic fallback bullet generator used when GEMINI_API_KEY is absent or rate-limited.
 */
export function buildDeterministicSentinelExplanation(
  input: SentinelPromptInput
): string[] {
  const bullets: string[] = [];
  const failed = input.findings.filter((f) => !f.passed);

  if (input.riskScore >= 50) {
    bullets.push(
      `• Blocked by AegisFlow Policy Gate with deterministic risk score ${input.riskScore}/100 (${input.riskBand.toUpperCase()}) — no Solana Blink or signing payload was created.`
    );
    for (const f of failed.slice(0, 3)) {
      bullets.push(`• ${f.check}: ${f.detail}`);
    }
    bullets.push(
      `• Wallet funds remain untouched: 0 SOL and 0 tokens will leave your account.`
    );
    return bullets.slice(0, 5);
  }

  if (input.intentKind === 'swap') {
    bullets.push(
      `• Net wallet effect: ${input.solDeltaUser.toFixed(6)} SOL outflow and +${input.dUsdcDeltaUser.toFixed(4)} dUSDC inflow settled atomically in a single Solana transaction.`
    );
  } else if (input.intentKind === 'transfer') {
    const shortDest = input.destination
      ? `${input.destination.slice(0, 6)}...${input.destination.slice(-4)}`
      : 'recipient';
    bullets.push(
      `• Net wallet effect: ${input.solDeltaUser.toFixed(6)} SOL leaves your wallet (${input.amountSol} SOL transferred to ${shortDest}).`
    );
  } else {
    bullets.push(
      `• Read-only or non-transactional request evaluated with risk score ${input.riskScore}/100.`
    );
  }

  bullets.push(
    `• Pre-flight simulation consumed ${input.unitsConsumed.toLocaleString()} compute units (~${input.feeSol.toFixed(6)} SOL network fee, well under $0.01).`
  );

  if (failed.length > 0) {
    for (const f of failed.slice(0, 2)) {
      bullets.push(`• Caution — ${f.check}: ${f.detail}`);
    }
  } else {
    bullets.push(
      `• All ${input.findings.length} deterministic security checks passed (allow-listed SPL/System programs only, within spending cap, zero override signals).`
    );
  }

  if (input.planSha256) {
    bullets.push(
      `• Verifiable AI proof: SHA-256 fingerprint aegis:v1:${input.planSha256.slice(0, 10)}...${input.planSha256.slice(-6)} is anchored on-chain via SPL Memo.`
    );
  }

  return bullets.slice(0, 5);
}

/**
 * Generates plain-English Sentinel explanation bullets using Gemini when available,
 * with automatic fallback to deterministic bullet formatting.
 */
export async function generateSentinelExplanation(
  input: SentinelPromptInput,
  apiKey?: string
): Promise<{ explanation: string; bullets: string[]; source: 'gemini' | 'deterministic' }> {
  const resolvedKey =
    apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (resolvedKey && resolvedKey !== 'mock-gemini-key' && resolvedKey !== 'your_gemini_api_key_here') {
    try {
      const model = new ChatGoogleGenerativeAI({
        model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
        apiKey: resolvedKey,
        temperature: 0.1,
        maxRetries: 1,
      });

      const userPrompt = buildSentinelPrompt(input);
      const response = await Promise.race([
        model.invoke([
          { role: 'system', content: SENTINEL_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Sentinel LLM timeout')), 4000)
        ),
      ]);

      const rawContent =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      let sanitized = sanitizeExplanationText(rawContent);
      if (input.riskScore >= 50) {
        sanitized = sanitized.replace(
          /\b(completely|totally|100%|entirely)\s+safe\b/gi,
          'high-risk (blocked)'
        );
      }
      const parsedBullets = sanitized
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) =>
          line.startsWith('•')
            ? line
            : `• ${line.replace(/^[-*]\s*/, '')}`
        )
        .slice(0, 5);

      if (parsedBullets.length >= 3) {
        return {
          explanation: parsedBullets.join('\n'),
          bullets: parsedBullets,
          source: 'gemini',
        };
      }
    } catch {
      // Fall through to deterministic bullet generator
    }
  }

  const bullets = buildDeterministicSentinelExplanation(input).map(sanitizeExplanationText);
  return {
    explanation: bullets.join('\n'),
    bullets,
    source: 'deterministic',
  };
}
