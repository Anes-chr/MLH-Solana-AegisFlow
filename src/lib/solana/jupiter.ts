import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_CONFIG } from './config';

export const WSOL_MAINNET_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export const JUPITER_REFERENCE_DISCLAIMER =
  'Read-only mainnet reference — execution routes through Devnet Vault';

export interface JupiterReferenceQuote {
  available: boolean;
  inAmountSol: number;
  outAmountUsdc: number | null;
  impliedSolUsd: number | null;
  priceImpactPct: number | null;
  routeLabels: string[];
  divergenceFromPythPct: number | null;
  isDivergenceWide: boolean;
  source: 'jupiter_quote_api' | 'unavailable_fallback';
  reason?: string;
  disclaimer: string;
}

interface RawJupiterQuote {
  inAmount?: string;
  outAmount?: string;
  priceImpactPct?: string;
  routePlan?: Array<{
    swapInfo?: {
      label?: string;
    };
  }>;
}

export function parseJupiterQuoteResponse(
  raw: unknown,
  amountSol: number,
  pythPriceUsd?: number
): JupiterReferenceQuote {
  const data = raw as RawJupiterQuote | null | undefined;
  if (!data || !data.outAmount) {
    return {
      available: false,
      inAmountSol: amountSol,
      outAmountUsdc: null,
      impliedSolUsd: null,
      priceImpactPct: null,
      routeLabels: [],
      divergenceFromPythPct: null,
      isDivergenceWide: false,
      source: 'unavailable_fallback',
      reason: 'No direct mainnet route found',
      disclaimer: JUPITER_REFERENCE_DISCLAIMER,
    };
  }

  const outAmountUsdc = Number(data.outAmount) / TOKEN_CONFIG.DUSDC_BASE_MULTIPLIER;
  if (!Number.isFinite(outAmountUsdc) || outAmountUsdc <= 0 || amountSol <= 0) {
    return {
      available: false,
      inAmountSol: amountSol,
      outAmountUsdc: null,
      impliedSolUsd: null,
      priceImpactPct: null,
      routeLabels: [],
      divergenceFromPythPct: null,
      isDivergenceWide: false,
      source: 'unavailable_fallback',
      reason: 'Invalid quote output amount',
      disclaimer: JUPITER_REFERENCE_DISCLAIMER,
    };
  }

  const impliedSolUsd = outAmountUsdc / amountSol;
  const priceImpactPct = data.priceImpactPct ? Number(data.priceImpactPct) : 0;
  const routeLabels = (data.routePlan ?? [])
    .map((r) => r.swapInfo?.label)
    .filter((label): label is string => Boolean(label));

  let divergenceFromPythPct: number | null = null;
  let isDivergenceWide = false;
  if (pythPriceUsd && pythPriceUsd > 0) {
    divergenceFromPythPct = Number(
      (Math.abs((impliedSolUsd - pythPriceUsd) / pythPriceUsd) * 100).toFixed(3)
    );
    isDivergenceWide = divergenceFromPythPct > 5.0;
  }

  return {
    available: true,
    inAmountSol: amountSol,
    outAmountUsdc: Number(outAmountUsdc.toFixed(4)),
    impliedSolUsd: Number(impliedSolUsd.toFixed(4)),
    priceImpactPct: Number.isFinite(priceImpactPct) ? priceImpactPct : 0,
    routeLabels,
    divergenceFromPythPct,
    isDivergenceWide,
    source: 'jupiter_quote_api',
    disclaimer: JUPITER_REFERENCE_DISCLAIMER,
  };
}

/**
 * Queries read-only Jupiter Mainnet reference quote for SOL -> USDC.
 * Never throws: degrades cleanly if JUPITER_API_KEY is missing, rate-limited (429), or unreachable.
 */
export async function getJupiterReferenceQuote(
  amountSol: number = 0.1,
  pythPriceUsd?: number
): Promise<JupiterReferenceQuote> {
  const effectiveSol = Number.isFinite(amountSol) && amountSol > 0 ? amountSol : 0.1;
  const lamports = Math.max(1_000, Math.round(effectiveSol * LAMPORTS_PER_SOL));
  const apiKey = process.env.JUPITER_API_KEY?.trim();

  const baseEndpoint = apiKey
    ? 'https://api.jup.ag/swap/v1/quote'
    : 'https://lite-api.jup.ag/swap/v1/quote';

  const url = `${baseEndpoint}?inputMint=${WSOL_MAINNET_MINT}&outputMint=${USDC_MAINNET_MINT}&amount=${lamports}&slippageBps=50`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      const reason =
        res.status === 429
          ? 'Jupiter reference API rate-limited (HTTP 429); displaying Pyth Hermes oracle'
          : `Jupiter reference unavailable (HTTP ${res.status}); displaying Pyth Hermes oracle`;
      return {
        available: false,
        inAmountSol: effectiveSol,
        outAmountUsdc: null,
        impliedSolUsd: null,
        priceImpactPct: null,
        routeLabels: [],
        divergenceFromPythPct: null,
        isDivergenceWide: false,
        source: 'unavailable_fallback',
        reason,
        disclaimer: JUPITER_REFERENCE_DISCLAIMER,
      };
    }

    const json = await res.json();
    return parseJupiterQuoteResponse(json, effectiveSol, pythPriceUsd);
  } catch {
    return {
      available: false,
      inAmountSol: effectiveSol,
      outAmountUsdc: null,
      impliedSolUsd: null,
      priceImpactPct: null,
      routeLabels: [],
      divergenceFromPythPct: null,
      isDivergenceWide: false,
      source: 'unavailable_fallback',
      reason: apiKey
        ? 'Mainnet reference quote timed out; using Pyth Hermes oracle'
        : 'Optional JUPITER_API_KEY not configured; using Pyth Hermes oracle',
      disclaimer: JUPITER_REFERENCE_DISCLAIMER,
    };
  } finally {
    clearTimeout(timer);
  }
}
