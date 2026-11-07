import { PYTH_CONFIG } from './config';

export interface PythPriceData {
  priceUsd: number;
  confidence: number;
  publishTime: number;
  feedId: string;
  source?: 'pyth_hermes' | 'binance_spot' | 'coingecko_spot' | 'deterministic_fallback';
  isFallback?: boolean;
}

interface HermesPriceResponse {
  parsed?: Array<{
    id: string;
    price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
  }>;
}

/**
 * Pure parser for Pyth Hermes v2 latest price responses.
 */
export function parsePythHermesResponse(
  rawData: unknown,
  expectedFeedId: string = PYTH_CONFIG.SOL_USD_FEED_ID
): PythPriceData {
  const data = rawData as HermesPriceResponse | null | undefined;
  const normalizedTarget = expectedFeedId.replace(/^0x/i, '').toLowerCase();
  const parsedFeed = data?.parsed?.find(
    (p) => p.id.replace(/^0x/i, '').toLowerCase() === normalizedTarget
  );

  if (!parsedFeed || !parsedFeed.price) {
    throw new Error('Pyth Hermes response did not contain expected SOL/USD price entry');
  }

  const { price, conf, expo, publish_time } = parsedFeed.price;
  const priceUsd = Number(price) * Math.pow(10, expo);
  const confidence = Number(conf) * Math.pow(10, expo);

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error(`Parsed invalid price from Pyth Hermes: ${priceUsd}`);
  }
  if (!Number.isFinite(confidence) || confidence < 0) {
    throw new Error(`Parsed invalid confidence from Pyth Hermes: ${confidence}`);
  }

  return {
    priceUsd,
    confidence,
    publishTime: publish_time,
    feedId: normalizedTarget,
    source: 'pyth_hermes',
    isFallback: false,
  };
}

/**
 * Tier 1: Fetch live price from Pyth Hermes v2 HTTP REST API.
 */
async function fetchFromPythHermes(): Promise<PythPriceData> {
  const feedId = PYTH_CONFIG.SOL_USD_FEED_ID;
  const baseUrl = (process.env.PYTH_HERMES_URL || PYTH_CONFIG.HERMES_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (process.env.PYTH_HERMES_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.PYTH_HERMES_API_KEY}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Pyth Hermes HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as HermesPriceResponse;
    return parsePythHermesResponse(data, feedId);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tier 2: Fetch spot price from public spot ticker fallback (Binance / CoinGecko).
 */
async function fetchFromPublicSpot(): Promise<PythPriceData> {
  // Try Binance Spot
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const price = parseFloat(json.price);
      if (!isNaN(price) && price > 0) {
        return {
          priceUsd: price,
          confidence: Number((price * 0.001).toFixed(4)), // ~10 bps synthetic confidence
          publishTime: Math.floor(Date.now() / 1000),
          feedId: PYTH_CONFIG.SOL_USD_FEED_ID,
          source: 'binance_spot',
          isFallback: true,
        };
      }
    }
  } catch (err) {
    // Continue to CoinGecko
  }

  // Try CoinGecko Spot
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const price = json?.solana?.usd;
      if (typeof price === 'number' && price > 0) {
        return {
          priceUsd: price,
          confidence: Number((price * 0.001).toFixed(4)),
          publishTime: Math.floor(Date.now() / 1000),
          feedId: PYTH_CONFIG.SOL_USD_FEED_ID,
          source: 'coingecko_spot',
          isFallback: true,
        };
      }
    }
    throw new Error('CoinGecko spot query returned invalid response');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tier 3: Deterministic Fallback price.
 */
function getDeterministicFallbackPrice(): PythPriceData {
  return {
    priceUsd: PYTH_CONFIG.DEFAULT_FALLBACK_PRICE_USD,
    confidence: PYTH_CONFIG.DEFAULT_FALLBACK_CONFIDENCE,
    publishTime: Math.floor(Date.now() / 1000),
    feedId: PYTH_CONFIG.SOL_USD_FEED_ID,
    source: 'deterministic_fallback',
    isFallback: true,
  };
}

/**
 * Primary entry point: Get live SOL/USD price with 3-tier cascade.
 * 1. Pyth Hermes v2 HTTP API (with optional Bearer auth)
 * 2. Public Spot Oracle (Binance / CoinGecko)
 * 3. Deterministic safe devnet fallback ($185.00 USD)
 */
export async function getLiveSolUsdPrice(): Promise<PythPriceData> {
  // Tier 1
  try {
    const data = await fetchFromPythHermes();
    return data;
  } catch (tier1Err) {
    // Tier 2
    try {
      const data = await fetchFromPublicSpot();
      return data;
    } catch (tier2Err) {
      // Tier 3
      return getDeterministicFallbackPrice();
    }
  }
}
