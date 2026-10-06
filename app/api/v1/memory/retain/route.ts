import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retainMemory } from '../../../../../lib/runtime/retention';
import { RetainRequest } from '../../../../../lib/runtime/retention/normalize';
import type { CanonicalRepository } from '../../../../../lib/runtime/repositories/interfaces';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), content: z.string().min(1), source: z.string().min(1), provenance: z.string().min(1), idempotencyKey: z.string().min(1), occurredAt: z.string().datetime().optional() }).strict();
export const createRetainHandler = (repository: CanonicalRepository) => async (request: Request) => {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const body = RequestSchema.parse(await request.json()) as RetainRequest;
    const result = await retainMemory(body, repository);
    return NextResponse.json({ ok: true, requestId, data: result }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid retain request' : error instanceof Error ? error.message : 'retain request failed';
    const status = message.includes('scope') ? 403 : message.includes('idempotency') ? 409 : 400;
    return NextResponse.json({ ok: false, requestId, error: message, retryable: false }, { status });
  }
};

export async function POST(request: Request) {
  return NextResponse.json({ ok: false, requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(), error: 'runtime repository is not configured', retryable: true }, { status: 503 });
}
