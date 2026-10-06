import { NextResponse } from 'next/server';
import { createRetainHandler } from '../../../../../lib/runtime/api-handlers';

export async function POST(request: Request) {
  return NextResponse.json({ ok: false, requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(), error: 'runtime repository is not configured', retryable: true }, { status: 503 });
}
