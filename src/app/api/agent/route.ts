import { NextResponse } from 'next/server';
import { runAegisPipeline } from '@/lib/agent/graph';
import { TOKEN_CONFIG } from '@/lib/solana/config';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const startTime = Date.now();

  let body: {
    prompt?: unknown;
    walletPubkey?: unknown;
    spendingCapSol?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload in /api/agent request.' },
      { status: 400 }
    );
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  const walletPubkey =
    typeof body.walletPubkey === 'string' && body.walletPubkey.trim().length > 0
      ? body.walletPubkey.trim()
      : undefined;

  const parsedCap = Number(body.spendingCapSol);
  const spendingCapSol =
    Number.isFinite(parsedCap) && parsedCap > 0
      ? Math.min(parsedCap, 100)
      : TOKEN_CONFIG.MAX_SOL_SWAP_DEVNET;

  const url = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  try {
    const pipelineState = await runAegisPipeline({
      prompt,
      walletPubkey,
      spendingCapSol,
      baseUrl,
    });

    return NextResponse.json(
      {
        ...pipelineState,
        latencyMs: Date.now() - startTime,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unexpected agent execution error';
    return NextResponse.json(
      {
        error: message,
        status: 'unsupported',
        latencyMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
