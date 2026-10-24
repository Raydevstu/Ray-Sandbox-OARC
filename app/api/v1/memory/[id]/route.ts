import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { updateMemory } from '@/lib/runtime/memory/service';
import { classifyOperationalState } from '@/lib/runtime/operational-state';
import { advanceWorkflowRun } from '@/lib/runtime/workflow-run-service';
import { apiFailure, apiSuccess } from '@/lib/runtime/api-envelope';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), workflowRunId: z.string().min(1).max(120).optional(), claim: z.string().trim().min(1).max(20_000) }).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const { id } = await context.params;
  return apiFailure(requestId, `memory lookup is not configured for ${id}`, 'unavailable', 503, { retryable: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    const scope = { tenantId: input.tenantId, bankId: input.bankId, projectId: input.projectId, workflowRunId: input.workflowRunId };
    authorize(principal, 'memory:write', scope);
    if (!isRuntimeStoreConfigured()) return apiFailure(requestId, 'canonical store is not configured', 'unavailable', 503, { retryable: true, workflowRunId: input.workflowRunId });
    const { id } = await context.params;
    const repository = createRuntimeRepository(scope);
    const revision = await updateMemory(scope, id, input.claim, repository);
    const workflow = await advanceWorkflowRun(repository, scope, { workflowRunId: input.workflowRunId, projectId: input.projectId, step: 'correct' });
    return apiSuccess(requestId, { revision, corrected: true, workflowRunId: input.workflowRunId, workflow }, { workflowRunId: input.workflowRunId, state: 'healthy' });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid correction request' : error instanceof Error && (error.message.includes('scope') || error.message.includes('permission')) ? 'scope denied' : error instanceof Error ? error.message : 'correction failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return apiFailure(requestId, message, classifyOperationalState({ ok: false, status, retryable: status === 503 }), status, { retryable: status === 503 });
  }
}
