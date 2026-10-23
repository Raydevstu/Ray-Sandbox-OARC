import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retainMemory } from './retention';
import { recallMemory } from './retrieval';
import { RetainRequest } from './retention/normalize';
import type { CanonicalRepository } from './repositories/interfaces';
import { classifyOperationalState } from './operational-state';
import type { RecallProfiler } from './recall-profiling';
import { measureRecallResponse } from './recall-response-metrics';
import { runtimeMetrics, type RuntimeOperation } from './live-metrics';
import { projectDashboardMetrics } from './project-dashboard-metrics';

const RetainSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1).optional(), content: z.string().min(1), source: z.string().min(1), provenance: z.string().min(1), idempotencyKey: z.string().min(1), occurredAt: z.string().datetime().optional() }).strict();
const RecallSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1).optional(), query: z.string().min(1), limit: z.number().int().positive().max(100).optional(), policy: z.enum(['current', 'historical', 'all-evidence']).optional(), tokenBudget: z.number().int().positive().max(10000).optional(), projection: z.enum(['full', 'summary']).optional() }).strict();

const recordResponse = (operation: RuntimeOperation, startedAt: number, response: Response, scope?: { tenantId: string; bankId: string; projectId?: string }) => {
  const observation = { operation, durationMs: Math.round(performance.now() - startedAt), outcome: response.ok ? 'success' as const : 'failure' as const };
  runtimeMetrics.record(observation);
  if (scope?.projectId) projectDashboardMetrics.recordProjectOperation({ tenantId: scope.tenantId, bankId: scope.bankId, projectId: scope.projectId }, { ...observation, app: 'memory' });
  return response;
};

export const createRetainHandler = (repository: CanonicalRepository) => async (request: Request) => {
  const startedAt = performance.now();
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  let input: z.infer<typeof RetainSchema> | undefined;
  try { input = RetainSchema.parse(await request.json()); const result = await retainMemory(input as RetainRequest, repository); return recordResponse('retain', startedAt, NextResponse.json({ ok: true, requestId, data: result, state: 'healthy' }, { status: result.replayed ? 200 : 201 }), input); }
  catch (error) { const message = error instanceof z.ZodError ? 'invalid retain request' : error instanceof Error ? error.message : 'retain request failed'; const status = message.includes('scope') ? 403 : message.includes('idempotency') ? 409 : 400; return recordResponse('retain', startedAt, NextResponse.json({ ok: false, requestId, error: message, retryable: false, state: classifyOperationalState({ ok: false, status }) }, { status }), input); }
};

export const createRecallHandler = (repository: CanonicalRepository, profiler?: RecallProfiler) => async (request: Request) => {
  const startedAt = performance.now();
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  let input: z.infer<typeof RecallSchema> | undefined;
  try { input = RecallSchema.parse(await request.json()); const result = await recallMemory(input, repository); const projection = input.projection ?? 'full'; const data = projection === 'summary' ? { projection, facts: result.facts.map(({ evidenceIds: _evidenceIds, ...fact }) => ({ ...fact, evidenceIds: undefined })), traceId: result.traceId } : { ...result, projection }; const metrics = measureRecallResponse(data); profiler?.mark('response'); const response = NextResponse.json({ ok: true, requestId, data, state: classifyOperationalState({ ok: true, status: 200, resultCount: result.facts.length }) }); if (profiler?.snapshot().enabled) { const timing = profiler.snapshot(); const pool = timing.pool ? `, poolWaiting=${timing.pool.waiting}, poolTotal=${timing.pool.total}` : ''; const lease = timing.lease ? `, leaseSequence=${timing.lease.sequence}, leaseWait=${timing.lease.waitMs}` : ''; response.headers.set('server-timing', `${Object.entries(timing.stages).map(([key, value]) => `${key};dur=${value}`).join(', ')}${pool}${lease}`); response.headers.set('x-recall-facts', String(metrics.facts)); response.headers.set('x-recall-evidence', String(metrics.evidence)); response.headers.set('x-recall-result-bytes', String(metrics.bytes)); } return recordResponse('recall', startedAt, response, input); }
  catch (error) { const message = error instanceof z.ZodError ? 'invalid recall request' : error instanceof Error ? error.message : 'recall request failed'; const status = message.includes('scope') ? 403 : 400; return recordResponse('recall', startedAt, NextResponse.json({ ok: false, requestId, error: message, retryable: false, state: classifyOperationalState({ ok: false, status }) }, { status }), input); }
};

export const readScope = async (request: Request): Promise<{ tenantId: string; bankId: string }> => {
  const body = await request.clone().json() as { tenantId?: unknown; bankId?: unknown };
  if (typeof body.tenantId !== 'string' || typeof body.bankId !== 'string') throw new Error('invalid runtime scope');
  return { tenantId: body.tenantId, bankId: body.bankId };
};

export const readProjectScope = async (request: Request): Promise<{ tenantId: string; bankId: string; projectId: string }> => {
  const body = await request.clone().json() as { tenantId?: unknown; bankId?: unknown; projectId?: unknown };
  if (typeof body.tenantId !== 'string' || typeof body.bankId !== 'string' || typeof body.projectId !== 'string') throw new Error('invalid runtime project scope');
  return { tenantId: body.tenantId, bankId: body.bankId, projectId: body.projectId };
};
