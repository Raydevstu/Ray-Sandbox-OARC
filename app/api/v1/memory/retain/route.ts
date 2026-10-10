import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { createRetainHandler, readProjectScope, readScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '../../../../../lib/runtime/repository';

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await readScope(request);
    const projectScope = await readProjectScope(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', projectScope);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, requestId, error: 'canonical store is not configured', retryable: true, state: 'unavailable' }, { status: 503 });
    return await createRetainHandler(createRuntimeRepository(scope))(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'retain request failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400;
    return NextResponse.json({ ok: false, requestId, error: message, retryable: false, state: status === 401 || status === 403 ? 'unauthorized' : 'failed' }, { status });
  }
}
