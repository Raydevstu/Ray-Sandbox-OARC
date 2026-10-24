import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { createRetainHandler, readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '../../../../../lib/runtime/repository';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await readProjectScope(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', scope);
    if (!isRuntimeStoreConfigured()) return apiFailure(requestId, 'canonical store is not configured', 'unavailable', 503, { retryable: true });
    return await createRetainHandler(createRuntimeRepository(scope))(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'retain request failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400;
    return apiFailure(requestId, message, status === 401 || status === 403 ? 'unauthorized' : 'failed', status, { retryable: false });
  }
}
