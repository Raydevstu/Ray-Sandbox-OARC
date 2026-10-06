import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  return NextResponse.json({ ok: false, requestId, error: 'canonical store is not configured', retryable: true }, { status: 503 });
}
