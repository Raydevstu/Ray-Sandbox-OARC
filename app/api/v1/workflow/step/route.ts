import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { advanceWorkflowRun } from '@/lib/runtime/workflow-run-service';

const Schema = z.object({ step: z.enum(['context', 'evaluate', 'learn', 'orchestrate']), tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), workflowRunId: z.string().min(1), payload: z.record(z.string(), z.unknown()).default({}) }).strict();
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const input = Schema.parse(await request.json());
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', input);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, requestId, state: 'unavailable', error: 'canonical store is not configured', retryable: true }, { status: 503 });
    const repository = createRuntimeRepository(input);
    const workflow = await advanceWorkflowRun(repository, input, { workflowRunId: input.workflowRunId, projectId: input.projectId, step: input.step });
    return NextResponse.json({ ok: true, requestId, workflowRunId: input.workflowRunId, state: 'healthy', data: { step: input.step, payload: input.payload, workflow } }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid workflow step' : error instanceof Error ? error.message : 'workflow step failed';
    const status = message.includes('permission') || message.includes('scope') ? 403 : message.includes('credential') ? 401 : 400;
    return NextResponse.json({ ok: false, requestId, state: status === 403 ? 'unauthorized' : 'failed', error: message, retryable: false }, { status });
  }
}
