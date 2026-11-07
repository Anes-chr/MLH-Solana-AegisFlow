import { NextResponse } from 'next/server';
import { InvalidMintError, scanTokenMint } from '@/lib/solana/scanner';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const mint = url.searchParams.get('mint') || '';
    const clusterParam = url.searchParams.get('cluster');
    const preferredCluster =
      clusterParam === 'devnet' || clusterParam === 'mainnet-beta'
        ? clusterParam
        : undefined;

    const report = await scanTokenMint(mint, preferredCluster);
    return NextResponse.json(report, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof InvalidMintError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }

    const msg = err instanceof Error ? err.message : 'Token scan failed';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
