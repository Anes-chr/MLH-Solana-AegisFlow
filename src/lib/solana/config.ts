import {
  Connection,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

export const SOLANA_NETWORK = 'devnet';

/**
 * Devnet RPC Endpoint Candidates in order of priority.
 * Evaluates environment variables first (Helius, private RPCs),
 * then public fallbacks.
 */
export const DEVNET_RPC_CANDIDATES: string[] = [
  process.env.HELIUS_RPC_URL,
  process.env.SOLANA_DEVNET_RPC_URL,
  process.env.SOLANA_RPC_URL,
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL,
  'https://api.devnet.solana.com',
  'https://rpc.ankr.com/solana_devnet',
].filter((url): url is string => Boolean(url && url.trim().length > 0));

/**
 * SPL Memo v2 Program ID
 */
export const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
);

/**
 * Compute Budget Program ID
 */
export const COMPUTE_BUDGET_PROGRAM_ID = new PublicKey(
  'ComputeBudget111111111111111111111111111111'
);

/**
 * Allow-list of safe program IDs for AegisFlow pre-flight policy gate.
 * Any transaction instruction targeting a program outside this set triggers
 * high risk in the Sentinel.
 */
export const ALLOWED_PROGRAM_IDS: Set<string> = new Set([
  SystemProgram.programId.toBase58(),
  TOKEN_PROGRAM_ID.toBase58(),
  ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
  MEMO_PROGRAM_ID.toBase58(),
  COMPUTE_BUDGET_PROGRAM_ID.toBase58(),
]);

/**
 * Pyth Hermes Configuration
 */
export const PYTH_CONFIG = {
  HERMES_BASE_URL: 'https://hermes.pyth.network',
  // Canonical Pyth Price Feed ID for Crypto.SOL/USD (64 hex characters)
  SOL_USD_FEED_ID:
    'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  DEFAULT_FALLBACK_PRICE_USD: 185.0,
  DEFAULT_FALLBACK_CONFIDENCE: 0.15,
  MAX_ACCEPTABLE_STALENESS_SEC: 120,
  MAX_ACCEPTABLE_RELATIVE_CONFIDENCE: 0.02, // 2%
};

/**
 * Devnet Token & Swap Configuration
 */
export const TOKEN_CONFIG = {
  DUSDC_DECIMALS: 6,
  DUSDC_BASE_MULTIPLIER: 1_000_000,
  MAX_SOL_SWAP_DEVNET: 1.0, // Spending cap for demo safety
  MAX_SOL_TRANSFER_DEVNET: 1.0,
};

/**
 * Known malicious / demo drainer addresses blocked deterministically by Sentinel.
 */
export const KNOWN_DRAINER_ADDRESSES: Set<string> = new Set([
  '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
  '9xHackerTargetAddress11111111111111111111111',
  'Drainer111111111111111111111111111111111111',
]);

/**
 * Connect to Solana Devnet with fallback across candidate RPC endpoints.
 */
export async function getSolanaConnection(
  timeoutMs: number = 60000
): Promise<Connection> {
  const candidates = DEVNET_RPC_CANDIDATES.length > 0
    ? DEVNET_RPC_CANDIDATES
    : [clusterApiUrl('devnet')];

  for (const endpoint of candidates) {
    try {
      const conn = new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: timeoutMs,
      });
      // Ping node with a short timeout to verify reachability without hanging
      await Promise.race([
        conn.getSlot('confirmed'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('RPC ping timeout')), 3500)
        ),
      ]);
      return conn;
    } catch {
      // Continue to next candidate
    }
  }

  // Final fallback to default devnet connection
  return new Connection(clusterApiUrl('devnet'), {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: timeoutMs,
  });
}
