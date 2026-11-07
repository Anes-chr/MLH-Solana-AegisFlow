import { NextResponse } from 'next/server';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana/config';
import { getDevnetVaultKeypair } from '@/lib/solana/vault';

export const runtime = 'nodejs';

const MICRO_FUND_SOL = 0.05;
const MIN_VAULT_RESERVE_SOL = 0.15;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;

const requestLog = new Map<string, number[]>();

function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(clientKey) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(clientKey, timestamps);
    return false;
  }
  timestamps.push(now);
  requestLog.set(clientKey, timestamps);
  return true;
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const rawPubkey =
    typeof body.pubkey === 'string'
      ? body.pubkey.trim()
      : typeof body.recipientPubkey === 'string'
      ? body.recipientPubkey.trim()
      : '';
  if (!rawPubkey) {
    return NextResponse.json(
      { error: 'Missing "pubkey" field in request body.' },
      { status: 400 }
    );
  }

  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(rawPubkey);
  } catch {
    return NextResponse.json(
      { error: `Invalid Solana base58 public key: "${rawPubkey}".` },
      { status: 400 }
    );
  }

  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const rateKey = `${forwardedFor}:${recipientPubkey.toBase58()}`;
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(
      {
        error: 'Rate limit reached for burner micro-funding (max 3 requests per 10 minutes).',
        faucetUrl: 'https://faucet.solana.com',
      },
      { status: 429 }
    );
  }

  try {
    const conn = await getSolanaConnection(12_000);
    const currentLamports = await conn.getBalance(recipientPubkey, 'confirmed');
    if (currentLamports >= MICRO_FUND_SOL * LAMPORTS_PER_SOL) {
      return NextResponse.json(
        {
          ok: true,
          funded: true,
          source: 'existing_balance',
          balanceSol: currentLamports / LAMPORTS_PER_SOL,
          signature: null,
          message: 'Burner wallet already holds sufficient Devnet SOL for testing.',
        },
        { status: 200 }
      );
    }

    // Tier 1: Transfer 0.05 SOL from AegisFlow Devnet Vault if Vault has >= 0.15 SOL
    try {
      const { keypair: vaultKp } = getDevnetVaultKeypair();
      const vaultLamports = await conn.getBalance(vaultKp.publicKey, 'confirmed');
      if (
        vaultLamports >= MIN_VAULT_RESERVE_SOL * LAMPORTS_PER_SOL &&
        !vaultKp.publicKey.equals(recipientPubkey)
      ) {
        const latest = await conn.getLatestBlockhash('confirmed');
        const tx = new Transaction({
          feePayer: vaultKp.publicKey,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        }).add(
          SystemProgram.transfer({
            fromPubkey: vaultKp.publicKey,
            toPubkey: recipientPubkey,
            lamports: Math.round(MICRO_FUND_SOL * LAMPORTS_PER_SOL),
          })
        );
        tx.sign(vaultKp);
        const sig = await conn.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        await conn.confirmTransaction(
          {
            signature: sig,
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight,
          },
          'confirmed'
        );
        const updated = await conn.getBalance(recipientPubkey, 'confirmed');
        return NextResponse.json(
          {
            ok: true,
            funded: true,
            source: 'aegis_vault',
            amountSol: MICRO_FUND_SOL,
            balanceSol: updated / LAMPORTS_PER_SOL,
            signature: sig,
            explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
            message: `Funded ${MICRO_FUND_SOL} Devnet SOL from AegisFlow Vault.`,
          },
          { status: 200 }
        );
      }
    } catch {
      // Proceed to RPC airdrop attempt
    }

    // Tier 2: Attempt standard Devnet RPC requestAirdrop (short timeout)
    try {
      const sig = await Promise.race([
        conn.requestAirdrop(recipientPubkey, Math.round(MICRO_FUND_SOL * LAMPORTS_PER_SOL)),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Airdrop timeout')), 5_000)
        ),
      ]);
      const latest = await conn.getLatestBlockhash('confirmed');
      await conn.confirmTransaction(
        {
          signature: sig,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        'confirmed'
      );
      const updated = await conn.getBalance(recipientPubkey, 'confirmed');
      return NextResponse.json(
        {
          ok: true,
          funded: true,
          source: 'devnet_airdrop',
          amountSol: MICRO_FUND_SOL,
          balanceSol: updated / LAMPORTS_PER_SOL,
          signature: sig,
          explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
          message: `Airdropped ${MICRO_FUND_SOL} Devnet SOL via Solana RPC.`,
        },
        { status: 200 }
      );
    } catch {
      // Public Devnet RPC faucet returned HTTP 410 / rate-limit: degrade cleanly
      return NextResponse.json(
        {
          ok: true,
          funded: false,
          simulationReady: true,
          source: 'faucet_rate_limited',
          balanceSol: currentLamports / LAMPORTS_PER_SOL,
          signature: null,
          faucetUrl: 'https://faucet.solana.com',
          message:
            'Public Devnet RPC faucet is currently rate-limited (HTTP 410). Your Guest Burner Wallet is ready for live pre-flight simulation and cryptographic Action co-signing — or request free Devnet SOL at faucet.solana.com.',
        },
        { status: 200 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Burner funding check failed';
    return NextResponse.json(
      {
        ok: true,
        funded: false,
        simulationReady: true,
        source: 'rpc_fallback',
        balanceSol: 0,
        faucetUrl: 'https://faucet.solana.com',
        message: `Devnet faucet unavailable (${msg}). Burner wallet remains active for simulation and cryptographic signing.`,
      },
      { status: 200 }
    );
  }
}
