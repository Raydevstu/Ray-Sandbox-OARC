import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';

const QuerySchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), limit: z.coerce.number().int().positive().max(500).optional() });

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const query = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (principal.tenantId !== query.tenantId) return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const scope = { tenantId: query.tenantId, bankId: query.bankId };
    const events = await createRuntimeRepository(scope).listProjectEvents(scope, query.projectId);
    return NextResponse.json({ ok: true, data: { projectId: query.projectId, events: events.slice(0, query.limit ?? 200) } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid events query' : error instanceof Error ? error.message : 'event read failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : 400 });
  }
}
