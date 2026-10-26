import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { createWorkflowReplay, type EvaluationCorrectionProposal, type EvaluationRun } from '@/lib/runtime/evaluation-contract';
import { classifyOperationalState } from '@/lib/runtime/operational-state';
import { apiFailure, apiSuccess } from '@/lib/runtime/api-envelope';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), workflowRunId: z.string().min(1).max(120).optional(), baseline: z.record(z.string(), z.unknown()), replay: z.record(z.string(), z.unknown()), proposal: z.record(z.string(), z.unknown()) }).strict();

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    authorize(principal, 'memory:write', { ...scope, projectId: input.projectId });
    const baseline = input.baseline as unknown as EvaluationRun;
    const replay = input.replay as unknown as EvaluationRun;
    const proposal = input.proposal as unknown as EvaluationCorrectionProposal;
    if (baseline.projectId !== input.projectId || replay.projectId !== input.projectId || proposal.projectId !== input.projectId) throw new Error('replay project scope mismatch');
    const workflow = { ...createWorkflowReplay(baseline, replay, proposal), ...(input.workflowRunId ? { workflowRunId: input.workflowRunId } : {}) };
    if (!isRuntimeStoreConfigured()) return apiFailure(requestId, 'canonical store is not configured', 'unavailable', 503, { workflowRunId: input.workflowRunId, retryable: true });
    const repository = createRuntimeRepository(scope);
    const current = input.workflowRunId ? await repository.getWorkflowRun(scope, input.workflowRunId) : undefined;
    const run = { tenantId: scope.tenantId, bankId: scope.bankId, workflowRunId: input.workflowRunId ?? workflow.id, projectId: input.projectId, mode: current?.mode ?? 'real' as const, currentStep: 'replay', completedSteps: [...new Set([...(current?.completedSteps ?? []), 'replay'])], status: current?.status ?? 'active' as const, createdAt: current?.createdAt ?? workflow.createdAt, updatedAt: new Date().toISOString() };
    await repository.saveEvaluationBundleAtomic(scope, input.projectId, baseline, replay, proposal, workflow.comparison, workflow, run);
    return apiSuccess(requestId, { ...workflow, workflowRun: run }, { workflowRunId: run.workflowRunId, state: 'healthy' }, 201);
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid replay request' : error instanceof Error && (error.message.includes('scope') || error.message.includes('permission')) ? 'scope denied' : error instanceof Error ? error.message : 'replay failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return apiFailure(requestId, message, classifyOperationalState({ ok: false, status, retryable: status === 503 }), status, { retryable: status === 503 });
  }
}
