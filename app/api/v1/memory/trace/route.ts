import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { recallMemory } from '@/lib/runtime/retrieval';
import { classifyOperationalState } from '@/lib/runtime/operational-state';
import { advanceWorkflowRun } from '@/lib/runtime/workflow-run-service';
import { apiFailure, apiSuccess } from '@/lib/runtime/api-envelope';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), workflowRunId: z.string().min(1).max(120).optional(), query: z.string().trim().min(1).max(2_000) }).strict();

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    authorize(principal, 'memory:read', scope);
    if (!isRuntimeStoreConfigured()) return apiFailure(requestId, 'canonical store is not configured', 'unavailable', 503, { retryable: true });
    const repository = createRuntimeRepository(scope);
    const retrieval = await recallMemory({ ...scope, projectId: input.projectId, workflowRunId: input.workflowRunId, query: input.query }, repository);
    await advanceWorkflowRun(repository, scope, { workflowRunId: input.workflowRunId, projectId: input.projectId, step: 'trace', traceId: retrieval.traceId });
    const trace = { traceId: retrieval.traceId, query: input.query, items: retrieval.facts.map((fact, index) => ({ recordId: fact.id, score: Math.max(0, 1 - index / Math.max(1, retrieval.facts.length)), confidence: fact.confidence, evidenceReferences: fact.evidenceIds, rationale: 'selected by scoped lexical retrieval', createdAt: fact.createdAt, updatedAt: fact.createdAt, status: 'active', source: { platform: 'developer-api', timestamp: fact.createdAt } })), gaps: [] };
    return apiSuccess(requestId, { projectId: input.projectId, workflowRunId: input.workflowRunId, trace, retrieval }, { workflowRunId: input.workflowRunId, state: classifyOperationalState({ ok: true, status: 200, resultCount: retrieval.facts.length }), trace: { traceId: retrieval.traceId } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid trace request' : error instanceof Error && (error.message.includes('scope') || error.message.includes('permission')) ? 'scope denied' : error instanceof Error ? error.message : 'trace failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return apiFailure(requestId, message, classifyOperationalState({ ok: false, status, retryable: status === 503 }), status, { retryable: status === 503 });
  }
}
