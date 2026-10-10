import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';

const QuerySchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), limit: z.coerce.number().int().positive().max(100).default(20) }).strict();

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const query = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    authorize(principal, 'memory:read', query);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured', retryable: true }, { status: 503 });
    const scope = { tenantId: query.tenantId, bankId: query.bankId };
    const conflicts = await createRuntimeRepository(scope).listGraphConflicts(scope);
    return NextResponse.json({ ok: true, data: { projectId: query.projectId, conflicts: conflicts.slice(0, query.limit) } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid conflicts query' : error instanceof Error ? error.message : 'conflicts read failed';
    const status = message.includes('credential') || message.includes('JWT') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return NextResponse.json({ ok: false, error: message, retryable: status === 503 }, { status });
  }
}
