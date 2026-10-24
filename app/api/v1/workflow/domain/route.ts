import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';

const Scope = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1) }).strict();
const Kind = z.enum(['learning_episode', 'orchestrator_graph']);
const failure = (error: unknown, fallback: string) => { const message = error instanceof z.ZodError ? fallback : error instanceof Error ? error.message : fallback; const status = message.includes('credential') ? 401 : message.includes('permission') || message.includes('scope') ? 403 : message.includes('store') ? 503 : 400; return NextResponse.json({ ok: false, requestId: crypto.randomUUID(), state: status === 503 ? 'unavailable' : status === 403 ? 'unauthorized' : 'failed', error: message, retryable: status === 503 }, { status }); };
export async function GET(request: Request) {
  try { const params = Object.fromEntries(new URL(request.url).searchParams); const scope = Scope.parse(params); const kind = Kind.parse(params.kind); const principal = await authenticateRequest(request, parseRuntimeConfig(process.env)); authorize(principal, 'memory:read', scope); if (!isRuntimeStoreConfigured()) throw new Error('canonical store is not configured'); const data = await createRuntimeRepository(scope).listPhase3DomainRecords(scope, scope.projectId, kind, 40); return NextResponse.json({ ok: true, requestId: crypto.randomUUID(), state: data.length ? 'healthy' : 'empty', data }); } catch (error) { return failure(error, 'invalid workflow domain query'); }
}
export async function POST(request: Request) {
  try { const input = z.object({ ...Scope.shape, kind: Kind, recordId: z.string().min(1), payload: z.record(z.string(), z.unknown()), updatedAt: z.string().datetime().optional() }).strict().parse(await request.json()); const principal = await authenticateRequest(request, parseRuntimeConfig(process.env)); authorize(principal, 'memory:write', input); if (!isRuntimeStoreConfigured()) throw new Error('canonical store is not configured'); const record = { ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }; await createRuntimeRepository(input).savePhase3DomainRecord(record); return NextResponse.json({ ok: true, requestId: crypto.randomUUID(), state: 'healthy', data: record }, { status: 201 }); } catch (error) { return failure(error, 'invalid workflow domain request'); }
}
