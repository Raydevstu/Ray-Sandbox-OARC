import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { retrieveTypedGraph } from '@/lib/runtime/typed-graph-service';

export const dynamic = 'force-dynamic';
const QuerySchema = z.object({ label: z.string().trim().min(1).max(200), at: z.string().datetime(), maxHops: z.coerce.number().int().min(1).max(2).default(2) });

export async function GET(request: Request) {
  try {
    await authenticateRequest(request, parseRuntimeConfig(process.env));
    const query = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const tenantId = process.env.APEX_AUDIT_TENANT_ID?.trim();
    const bankId = process.env.APEX_AUDIT_BANK_ID?.trim();
    if (!tenantId || !bankId) return NextResponse.json({ ok: false, error: 'graph scope is not configured' }, { status: 503 });
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const data = await retrieveTypedGraph(createRuntimeRepository({ tenantId, bankId }), { tenantId, bankId }, query.label, { at: query.at, maxHops: query.maxHops });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid graph query' : error instanceof Error ? error.message : 'graph read failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') || message.includes('JWT') ? 401 : 400 });
  }
}
