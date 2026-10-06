import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recallMemory } from '../../../../../lib/runtime/retrieval';
import type { CanonicalRepository } from '../../../../../lib/runtime/repositories/interfaces';

const RequestSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), query: z.string().min(1), limit: z.number().int().positive().max(100).optional(), policy: z.enum(['current', 'historical', 'all-evidence']).optional(), tokenBudget: z.number().int().positive().max(10000).optional() }).strict();
export const createRecallHandler = (repository: CanonicalRepository) => async (request: Request) => {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try { const result = await recallMemory(RequestSchema.parse(await request.json()), repository); return NextResponse.json({ ok: true, requestId, data: result }); } catch (error) { const message = error instanceof z.ZodError ? 'invalid recall request' : error instanceof Error ? error.message : 'recall request failed'; return NextResponse.json({ ok: false, requestId, error: message, retryable: false }, { status: message.includes('scope') ? 403 : 400 }); }
};

export async function POST(request: Request) { return NextResponse.json({ ok: false, requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(), error: 'runtime repository is not configured', retryable: true }, { status: 503 }); }
