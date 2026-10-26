import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { buildRetrievalTrace } from '@/lib/runtime/retrieval-trace';

export const dynamic = 'force-dynamic';
const QuerySchema = z.object({ projectId: z.string().trim().min(1).max(200), query: z.string().trim().min(1).max(1000) });
const redact = (value: string): string => createHash('sha256').update(value).digest('hex').slice(0, 12);

export async function GET(request: Request) {
  try {
    const input = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const tenantId = process.env.APEX_AUDIT_TENANT_ID?.trim();
    const bankId = process.env.APEX_AUDIT_BANK_ID?.trim();
    if (!tenantId || !bankId || !isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'share scope is unavailable' }, { status: 503 });
    const repository = createRuntimeRepository({ tenantId, bankId });
    const records = await repository.listProjectMemory({ tenantId, bankId }, input.projectId);
    const trace = buildRetrievalTrace(records, input.query);
    return NextResponse.json({ ok: true, data: { projectId: redact(input.projectId), query: '[redacted]', trace: { ...trace, query: '[redacted]', items: trace.items.map((item) => ({ ...item, recordId: redact(item.recordId), evidenceReferences: item.evidenceReferences.map(redact), source: { platform: item.source.platform, timestamp: item.source.timestamp } })), exclusions: (trace.exclusions ?? []).map(redact) } } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid shared trace query' : error instanceof Error ? error.message : 'shared trace failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
