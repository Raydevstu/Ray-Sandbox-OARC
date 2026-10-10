import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { buildRetrievalTrace } from '@/lib/runtime/retrieval-trace';

export const dynamic = 'force-dynamic';
const QuerySchema = z.object({ projectId: z.string().trim().min(1).max(200), query: z.string().trim().min(1).max(1000) });

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const tenantId = process.env.APEX_AUDIT_TENANT_ID?.trim();
    const bankId = process.env.APEX_AUDIT_BANK_ID?.trim();
    if (!tenantId || !bankId) return NextResponse.json({ ok: false, error: 'trace scope is not configured' }, { status: 503 });
    authorize(principal, 'memory:read', { tenantId, bankId, projectId: input.projectId });
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const repository = createRuntimeRepository({ tenantId, bankId });
    const records = await repository.listProjectMemory({ tenantId, bankId }, input.projectId);
    const graph = await repository.listGraph({ tenantId, bankId });
    const trace = buildRetrievalTrace(records, input.query);
    return NextResponse.json({ ok: true, data: { projectId: input.projectId, query: input.query, trace, graph } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid trace query' : error instanceof Error ? error.message : 'trace read failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credentials') || message.includes('JWT') ? 401 : message.includes('scope denied') || message.includes('scope does not match') || message.includes('permission') ? 403 : 400 });
  }
}
