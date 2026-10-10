import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retainMemory } from './retention';
import { recallMemory } from './retrieval';
import { RetainRequest } from './retention/normalize';
import type { CanonicalRepository } from './repositories/interfaces';
import { classifyOperationalState } from './operational-state';

const RetainSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1).optional(), content: z.string().min(1), source: z.string().min(1), provenance: z.string().min(1), idempotencyKey: z.string().min(1), occurredAt: z.string().datetime().optional() }).strict();
const RecallSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1).optional(), query: z.string().min(1), limit: z.number().int().positive().max(100).optional(), policy: z.enum(['current', 'historical', 'all-evidence']).optional(), tokenBudget: z.number().int().positive().max(10000).optional() }).strict();

export const createRetainHandler = (repository: CanonicalRepository) => async (request: Request) => {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try { const result = await retainMemory(RetainSchema.parse(await request.json()) as RetainRequest, repository); return NextResponse.json({ ok: true, requestId, data: result, state: 'healthy' }, { status: result.replayed ? 200 : 201 }); }
  catch (error) { const message = error instanceof z.ZodError ? 'invalid retain request' : error instanceof Error ? error.message : 'retain request failed'; const status = message.includes('scope') ? 403 : message.includes('idempotency') ? 409 : 400; return NextResponse.json({ ok: false, requestId, error: message, retryable: false, state: classifyOperationalState({ ok: false, status }) }, { status }); }
};

export const createRecallHandler = (repository: CanonicalRepository) => async (request: Request) => {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try { const result = await recallMemory(RecallSchema.parse(await request.json()), repository); return NextResponse.json({ ok: true, requestId, data: result, state: classifyOperationalState({ ok: true, status: 200, resultCount: result.facts.length }) }); }
  catch (error) { const message = error instanceof z.ZodError ? 'invalid recall request' : error instanceof Error ? error.message : 'recall request failed'; const status = message.includes('scope') ? 403 : 400; return NextResponse.json({ ok: false, requestId, error: message, retryable: false, state: classifyOperationalState({ ok: false, status }) }, { status }); }
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
