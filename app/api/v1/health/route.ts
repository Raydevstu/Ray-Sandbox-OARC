import { NextResponse } from 'next/server';
import { checkRuntimeStore } from '../../../../lib/runtime/repository';

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const canonicalStore = await checkRuntimeStore();
  return NextResponse.json({ ok: true, requestId, data: { status: 'ok', components: { api: 'ok', canonicalStore } } });
}
