import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { updateMemory } from '@/lib/runtime/memory/service';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), claim: z.string().trim().min(1).max(20_000) }).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const { id } = await context.params;
  return NextResponse.json({ ok: false, requestId, error: `memory lookup is not configured for ${id}`, retryable: true }, { status: 503 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    authorize(principal, 'memory:write', scope);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, requestId, error: 'canonical store is not configured', retryable: true }, { status: 503 });
    const { id } = await context.params;
    const revision = await updateMemory(scope, id, input.claim, createRuntimeRepository(scope));
    return NextResponse.json({ ok: true, requestId, data: { revision, corrected: true } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid correction request' : error instanceof Error && (error.message.includes('scope') || error.message.includes('permission')) ? 'scope denied' : error instanceof Error ? error.message : 'correction failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return NextResponse.json({ ok: false, requestId, error: message, retryable: status === 503 }, { status });
  }
}
