import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import {
  createActionHeaders,
  type ActionError,
  type ActionGetResponse,
  type ActionPostResponse,
} from '@solana/actions';
import { resolveActionPlan } from '@/lib/agent/plan-store';
import { evaluatePolicyRules } from '@/lib/agent/policy';
import {
  getSolanaConnection,
  KNOWN_DRAINER_ADDRESSES,
  MEMO_PROGRAM_ID,
  TOKEN_CONFIG,
} from '@/lib/solana/config';
import { buildAtomicSwapTransaction, hashPlanPayload } from '@/lib/solana/swap';
import { buildSolTransferTransaction } from '@/lib/solana/transfer';
import { getDevnetVaultConfig } from '@/lib/solana/vault';

export const runtime = 'nodejs';

const ACTION_HEADERS = createActionHeaders({
  chainId: 'devnet',
  actionVersion: '2.2.1',
});

function jsonError(message: string, status: number) {
  const body: ActionError = { message };
  return NextResponse.json(body, {
    status,
    headers: ACTION_HEADERS,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: ACTION_HEADERS,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const planId = url.searchParams.get('plan')?.trim() || '';
  const signedToken = url.searchParams.get('token')?.trim() || null;

  if (!planId) {
    return jsonError("Missing required 'plan' query parameter.", 400);
  }

  const storedPlan = resolveActionPlan(planId, signedToken);
  if (!storedPlan) {
    return jsonError('Action plan not found or expired.', 404);
  }

  if (storedPlan.riskScore >= 50) {
    return jsonError('Action refused by AegisFlow security policy.', 403);
  }

  const iconUrl = `${url.origin}/aegis-icon.svg`;
  const isSwap = storedPlan.intentKind === 'swap';
  const title = isSwap
    ? `AegisFlow: Swap ${storedPlan.amountSol} SOL -> ${(
        storedPlan.expectedDUsdc ?? 0
      ).toFixed(4)} dUSDC`
    : `AegisFlow: Send ${storedPlan.amountSol} SOL -> ${(
        storedPlan.destination ?? ''
      ).slice(0, 6)}...${(storedPlan.destination ?? '').slice(-4)}`;

  const cleanBullets = storedPlan.explanationBullets
    .map((b) => b.replace(/^•\s*/, ''))
    .join(' ');

  const description = `[Risk Score: ${storedPlan.riskScore}/100 (${storedPlan.riskBand.toUpperCase()})] ${cleanBullets}`;
  const label = isSwap ? 'Sign & Swap (Devnet)' : 'Sign & Transfer (Devnet)';

  const responsePayload: ActionGetResponse = {
    type: 'action',
    icon: iconUrl,
    title,
    description,
    label,
    links: {
      actions: [
        {
          type: 'transaction',
          label,
          href: `${url.pathname}${url.search}`,
        },
      ],
    },
  };

  return NextResponse.json(responsePayload, {
    status: 200,
    headers: ACTION_HEADERS,
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const planId = url.searchParams.get('plan')?.trim() || '';
  const signedToken = url.searchParams.get('token')?.trim() || null;

  if (!planId) {
    return jsonError("Missing required 'plan' query parameter.", 400);
  }

  const storedPlan = resolveActionPlan(planId, signedToken);
  if (!storedPlan) {
    return jsonError('Action plan not found or expired.', 404);
  }

  if (storedPlan.riskScore >= 50) {
    return jsonError('Action refused by AegisFlow security policy.', 403);
  }

  // Verify cryptographic plan hash integrity before constructing transaction
  const recomputedHash = hashPlanPayload(storedPlan.planJson);
  if (recomputedHash !== storedPlan.planSha256) {
    return jsonError('Plan hash integrity check failed.', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError('Invalid JSON request body.', 400);
  }

  const accountStr = typeof body?.account === 'string' ? body.account.trim() : '';
  if (!accountStr) {
    return jsonError("Missing required 'account' public key in request body.", 400);
  }

  let accountPubkey: PublicKey;
  try {
    accountPubkey = new PublicKey(accountStr);
  } catch {
    return jsonError("Invalid Solana base58 'account' public key.", 400);
  }

  const vaultConfig = getDevnetVaultConfig();
  if (accountPubkey.equals(vaultConfig.vaultPubkey)) {
    return jsonError(
      'Signer account cannot be the AegisFlow Devnet Vault authority.',
      400
    );
  }

  if (KNOWN_DRAINER_ADDRESSES.has(accountPubkey.toBase58())) {
    return jsonError('Action refused: signer matches blocklisted address.', 403);
  }

  const effectiveSpendingCapSol =
    storedPlan.spendingCapSol ?? TOKEN_CONFIG.MAX_SOL_SWAP_DEVNET;

  // Pre-verify deterministic policy against the signing account before RPC blockhash fetch
  const preSignerPolicy = evaluatePolicyRules({
    simOk: true,
    programs: [MEMO_PROGRAM_ID.toBase58()],
    amountSol: storedPlan.amountSol,
    expectedDUsdc: storedPlan.expectedDUsdc,
    pythPriceUsd: storedPlan.pythPriceUsd,
    maxSlippageBps: storedPlan.maxSlippageBps,
    destination: storedPlan.destination ?? null,
    senderPubkey: accountPubkey.toBase58(),
    promptText: '',
    spendingCapSol: effectiveSpendingCapSol,
  });

  if (
    !preSignerPolicy.approved ||
    Math.max(storedPlan.riskScore, preSignerPolicy.score) >= 50
  ) {
    return jsonError(
      preSignerPolicy.refusalReason ||
        'Action refused by AegisFlow security policy for this signing account.',
      403
    );
  }

  try {
    const connection = await getSolanaConnection();
    // Always fetch a fresh confirmed blockhash inside Action POST right before signing
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');

    let txBase64: string;
    let transaction;
    if (storedPlan.intentKind === 'swap') {
      const expectedOut =
        storedPlan.expectedDUsdc ??
        Number((storedPlan.amountSol * storedPlan.pythPriceUsd).toFixed(6));

      const built = await buildAtomicSwapTransaction({
        connection,
        userPubkey: accountPubkey,
        amountSol: storedPlan.amountSol,
        expectedDUsdcAmount: expectedOut,
        planHashHex: storedPlan.planSha256,
        recentBlockhash: latestBlockhash.blockhash,
      });
      txBase64 = built.txBase64;
      transaction = built.transaction;
    } else {
      if (!storedPlan.destination) {
        return jsonError('Transfer plan is missing destination public key.', 400);
      }
      const recipientPubkey = new PublicKey(storedPlan.destination);
      const built = await buildSolTransferTransaction({
        connection,
        userPubkey: accountPubkey,
        recipientPubkey,
        amountSol: storedPlan.amountSol,
        planHashHex: storedPlan.planSha256,
        recentBlockhash: latestBlockhash.blockhash,
      });
      txBase64 = built.txBase64;
      transaction = built.transaction;
    }

    // Re-evaluate deterministic policy against the actual built transaction's instruction program IDs
    const signerPolicy = evaluatePolicyRules({
      simOk: true,
      programs: transaction.instructions.map((ix) => ix.programId.toBase58()),
      amountSol: storedPlan.amountSol,
      expectedDUsdc: storedPlan.expectedDUsdc,
      pythPriceUsd: storedPlan.pythPriceUsd,
      maxSlippageBps: storedPlan.maxSlippageBps,
      destination: storedPlan.destination ?? null,
      senderPubkey: accountPubkey.toBase58(),
      promptText: '',
      spendingCapSol:
        storedPlan.spendingCapSol ?? TOKEN_CONFIG.MAX_SOL_SWAP_DEVNET,
    });

    const effectiveRiskScore = Math.max(storedPlan.riskScore, signerPolicy.score);
    if (!signerPolicy.approved || effectiveRiskScore >= 50) {
      return jsonError(
        signerPolicy.refusalReason ||
          'Action refused by AegisFlow security policy for this signing account.',
        403
      );
    }

    const postResponse: ActionPostResponse = {
      type: 'transaction',
      transaction: txBase64,
      message: `AegisFlow verified plan aegis:v1:${storedPlan.planSha256.slice(0, 12)}... (Risk ${effectiveRiskScore}/100)`,
    };

    return NextResponse.json(postResponse, {
      status: 200,
      headers: ACTION_HEADERS,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to assemble transaction';
    return jsonError(msg, 500);
  }
}
