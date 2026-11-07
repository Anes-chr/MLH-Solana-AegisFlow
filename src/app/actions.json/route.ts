import { NextResponse } from 'next/server';
import { createActionHeaders, type ActionsJson } from '@solana/actions';

export const runtime = 'nodejs';

const ACTION_HEADERS = createActionHeaders({
  chainId: 'devnet',
  actionVersion: '2.2.1',
});

export async function GET() {
  const payload: ActionsJson = {
    rules: [
      {
        pathPattern: '/aegis',
        apiPath: '/api/actions/aegis',
      },
      {
        pathPattern: '/aegis/**',
        apiPath: '/api/actions/aegis/**',
      },
      {
        pathPattern: '/api/actions/**',
        apiPath: '/api/actions/**',
      },
    ],
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: ACTION_HEADERS,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: ACTION_HEADERS,
  });
}
