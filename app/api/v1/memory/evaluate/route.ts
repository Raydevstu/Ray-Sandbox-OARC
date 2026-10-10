import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { aggregateEvaluationMetrics, validateEvaluationRun, type EvaluationRun } from '@/lib/runtime/evaluation-contract';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), run: z.record(z.string(), z.unknown()) }).strict();

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = RequestSchema.parse(await request.json());
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    authorize(principal, 'memory:write', scope);
    const run = input.run as unknown as EvaluationRun;
    if (run.projectId !== input.projectId) throw new Error('evaluation project scope mismatch');
    validateEvaluationRun(run);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, requestId, error: 'canonical store is not configured', retryable: true }, { status: 503 });
    const metrics = aggregateEvaluationMetrics(run);
    const persisted = { ...run, metrics };
    await createRuntimeRepository(scope).saveEvaluationRun(scope, input.projectId, persisted);
    return NextResponse.json({ ok: true, requestId, data: { run: persisted, metrics } }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid evaluation request' : error instanceof Error && (error.message.includes('scope') || error.message.includes('permission')) ? 'scope denied' : error instanceof Error ? error.message : 'evaluation failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return NextResponse.json({ ok: false, requestId, error: message, retryable: status === 503 }, { status });
  }
}
