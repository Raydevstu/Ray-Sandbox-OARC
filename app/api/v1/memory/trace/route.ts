import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { recallMemory } from '@/lib/runtime/retrieval';
import { classifyOperationalState } from '@/lib/runtime/operational-state';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), query: z.string().trim().min(1).max(2_000) }).strict();

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    authorize(principal, 'memory:read', { ...scope, projectId: input.projectId });
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, requestId, error: 'canonical store is not configured', retryable: true, state: 'unavailable' }, { status: 503 });
    const retrieval = await recallMemory({ ...scope, projectId: input.projectId, query: input.query }, createRuntimeRepository(scope));
    const trace = { traceId: retrieval.traceId, query: input.query, items: retrieval.facts.map((fact, index) => ({ recordId: fact.id, score: Math.max(0, 1 - index / Math.max(1, retrieval.facts.length)), confidence: fact.confidence, evidenceReferences: fact.evidenceIds, rationale: 'selected by scoped lexical retrieval', createdAt: fact.createdAt, updatedAt: fact.createdAt, status: 'active', source: { platform: 'developer-api', timestamp: fact.createdAt } })), gaps: [] };
    return NextResponse.json({ ok: true, requestId, data: { projectId: input.projectId, trace, retrieval }, state: classifyOperationalState({ ok: true, status: 200, resultCount: retrieval.facts.length }) });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid trace request' : error instanceof Error && (error.message.includes('scope') || error.message.includes('permission')) ? 'scope denied' : error instanceof Error ? error.message : 'trace failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return NextResponse.json({ ok: false, requestId, error: message, retryable: status === 503, state: classifyOperationalState({ ok: false, status, retryable: status === 503 }) }, { status });
  }
}
