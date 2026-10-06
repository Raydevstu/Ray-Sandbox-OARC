import { NextResponse } from 'next/server';
import { checkRuntimeStore } from '../../../../lib/runtime/repository';

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const status = await checkRuntimeStore();
  if (status === 'healthy') return NextResponse.json({ ok: true, requestId, data: { status: 'ready' } });
  return NextResponse.json({ ok: false, requestId, error: status === 'not_configured' ? 'canonical store is not configured' : 'canonical store is unavailable', retryable: true }, { status: 503 });
}
