import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import type { WorkflowRun } from '@/lib/runtime/contracts';
import { apiFailure, apiSuccess } from '@/lib/runtime/api-envelope';

const ScopeSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), workflowRunId: z.string().min(1).max(120) });
const WriteSchema = ScopeSchema.extend({ mode: z.enum(['sample', 'real']), currentStep: z.string().min(1).max(80), completedSteps: z.array(z.string().min(1).max(80)).max(32), status: z.enum(['active', 'completed', 'failed', 'degraded']), createdAt: z.string().datetime().optional(), updatedAt: z.string().datetime().optional(), lastTraceId: z.string().max(200).optional(), lastEventId: z.string().max(200).optional() }).strict();

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = WriteSchema.parse(await request.json());
    authorize(principal, 'memory:write', input);
    if (!isRuntimeStoreConfigured()) return apiFailure(requestId, 'canonical store is not configured', 'unavailable', 503);
    const now = new Date().toISOString();
    const run: WorkflowRun = { ...input, createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now };
    await createRuntimeRepository(input).upsertWorkflowRun(run);
    return apiSuccess(requestId, run, { workflowRunId: run.workflowRunId, state: 'healthy' }, 201);
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid workflow run request' : error instanceof Error ? error.message : 'workflow run write failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return apiFailure(requestId, message, status === 503 ? 'unavailable' : status === 401 || status === 403 ? 'unauthorized' : 'failed', status);
  }
}

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = ScopeSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    authorize(principal, 'memory:read', input);
    if (!isRuntimeStoreConfigured()) return apiFailure(requestId, 'canonical store is not configured', 'unavailable', 503);
    const run = await createRuntimeRepository(input).getWorkflowRun(input, input.workflowRunId);
    return run ? apiSuccess(requestId, run, { workflowRunId: run.workflowRunId, state: 'healthy' }) : apiSuccess(requestId, null, { workflowRunId: input.workflowRunId, state: 'empty' });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid workflow run query' : error instanceof Error ? error.message : 'workflow run read failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return apiFailure(requestId, message, status === 503 ? 'unavailable' : status === 401 || status === 403 ? 'unauthorized' : 'failed', status);
  }
}
