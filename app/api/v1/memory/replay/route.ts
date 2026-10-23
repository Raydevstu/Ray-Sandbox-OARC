import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { createWorkflowReplay, type EvaluationCorrectionProposal, type EvaluationRun } from '@/lib/runtime/evaluation-contract';
import { classifyOperationalState } from '@/lib/runtime/operational-state';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), baseline: z.record(z.string(), z.unknown()), replay: z.record(z.string(), z.unknown()), proposal: z.record(z.string(), z.unknown()) }).strict();

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    authorize(principal, 'memory:write', scope);
    const baseline = input.baseline as unknown as EvaluationRun;
    const replay = input.replay as unknown as EvaluationRun;
    const proposal = input.proposal as unknown as EvaluationCorrectionProposal;
    if (baseline.projectId !== input.projectId || replay.projectId !== input.projectId || proposal.projectId !== input.projectId) throw new Error('replay project scope mismatch');
    const workflow = createWorkflowReplay(baseline, replay, proposal);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, requestId, error: 'canonical store is not configured', retryable: true, state: 'unavailable' }, { status: 503 });
    const repository = createRuntimeRepository(scope);
    await repository.saveEvaluationRun(scope, input.projectId, baseline);
    await repository.saveEvaluationRun(scope, input.projectId, replay);
    await repository.saveEvaluationCorrection(scope, proposal);
    await repository.saveReplayComparison(scope, workflow.comparison);
    await repository.saveWorkflowReplay(scope, workflow);
    return NextResponse.json({ ok: true, requestId, data: workflow, state: 'healthy' }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid replay request' : error instanceof Error && (error.message.includes('scope') || error.message.includes('permission')) ? 'scope denied' : error instanceof Error ? error.message : 'replay failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return NextResponse.json({ ok: false, requestId, error: message, retryable: status === 503, state: classifyOperationalState({ ok: false, status, retryable: status === 503 }) }, { status });
  }
}
