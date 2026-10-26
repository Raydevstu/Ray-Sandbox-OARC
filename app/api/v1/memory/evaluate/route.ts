import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { aggregateEvaluationMetrics, validateEvaluationRun, type EvaluationRun } from '@/lib/runtime/evaluation-contract';
import { classifyOperationalState } from '@/lib/runtime/operational-state';
import { createEventEnvelope, createOutboxRecord } from '@/lib/runtime/events/envelope';
import { apiFailure, apiSuccess } from '@/lib/runtime/api-envelope';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), workflowRunId: z.string().min(1).max(120).optional(), run: z.record(z.string(), z.unknown()) }).strict();

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    authorize(principal, 'memory:write', { ...scope, projectId: input.projectId });
    const run = input.run as unknown as EvaluationRun;
    if (run.projectId !== input.projectId) throw new Error('evaluation project scope mismatch');
    validateEvaluationRun(run);
    if (!isRuntimeStoreConfigured()) return apiFailure(requestId, 'canonical store is not configured', 'unavailable', 503, { workflowRunId: input.workflowRunId, retryable: true });
    const metrics = aggregateEvaluationMetrics(run);
    const persisted = { ...run, metrics, ...(input.workflowRunId ? { workflowRunId: input.workflowRunId } : {}) };
    const repository = createRuntimeRepository(scope);
    const workflow = input.workflowRunId ? { ...(await repository.getWorkflowRun(scope, input.workflowRunId)), tenantId: scope.tenantId, bankId: scope.bankId, workflowRunId: input.workflowRunId, projectId: input.projectId, mode: 'real' as const, currentStep: 'evaluate', completedSteps: [...new Set([...(await repository.getWorkflowRun(scope, input.workflowRunId))?.completedSteps ?? [], 'evaluate'])], status: 'completed' as const, createdAt: (await repository.getWorkflowRun(scope, input.workflowRunId))?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() } : undefined;
    const idempotencyKey = `evaluation:${scope.tenantId}:${scope.bankId}:${input.projectId}:${persisted.id}:${input.workflowRunId ?? 'none'}`;
    const event = createEventEnvelope({ ...scope, type: 'EvaluationCompleted', occurredAt: persisted.generatedAt, idempotencyKey, payload: { projectId: input.projectId, evaluationRunId: persisted.id, workflowRunId: input.workflowRunId, metrics } });
    await repository.saveEvaluationAtomic(scope, input.projectId, persisted, event, createOutboxRecord(event, idempotencyKey), workflow);
    return apiSuccess(requestId, { run: persisted, metrics, workflow }, { workflowRunId: input.workflowRunId, state: 'healthy' }, 201);
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid evaluation request' : error instanceof Error && (error.message.includes('scope') || error.message.includes('permission')) ? 'scope denied' : error instanceof Error ? error.message : 'evaluation failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return apiFailure(requestId, message, classifyOperationalState({ ok: false, status, retryable: status === 503 }), status, { retryable: status === 503 });
  }
}

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const params = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1) }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:read', params);
    if (!isRuntimeStoreConfigured()) return apiFailure(requestId, 'canonical store is not configured', 'unavailable', 503, { retryable: true });
    const runs = await createRuntimeRepository(params).listEvaluationRuns(params, params.projectId, 40);
    return apiSuccess(requestId, { runs }, { state: runs.length ? 'healthy' : 'empty' });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid evaluation query' : error instanceof Error ? error.message : 'evaluation read failed';
    const status = message.includes('credential') ? 401 : message.includes('permission') || message.includes('scope') ? 403 : message.includes('store') ? 503 : 400;
    return apiFailure(requestId, message, classifyOperationalState({ ok: false, status, retryable: status === 503 }), status, { retryable: status === 503 });
  }
}
