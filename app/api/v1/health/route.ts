import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  return NextResponse.json({ ok: true, requestId, data: { status: 'ok', components: { api: 'ok', canonicalStore: 'not_configured' } } });
}
