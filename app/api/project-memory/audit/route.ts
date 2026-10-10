import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { readProjectMemoryAudit } from '@/lib/runtime/audit-read';
import { getCaptureStatus } from '@/lib/runtime/capture-status';

export const dynamic = 'force-dynamic';
const QuerySchema = z.object({ projectId: z.string().trim().min(1).max(200), filter: z.string().optional() });

export async function GET(request: Request) {
  try {
    await authenticateRequest(request, parseRuntimeConfig(process.env));
    const query = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const tenantId = process.env.APEX_AUDIT_TENANT_ID?.trim();
    const bankId = process.env.APEX_AUDIT_BANK_ID?.trim();
    if (!tenantId || !bankId) return NextResponse.json({ ok: false, error: 'audit scope is not configured', data: { capture: getCaptureStatus() } }, { status: 503 });
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured', data: { capture: getCaptureStatus() } }, { status: 503 });
    const filter = query.filter ? JSON.parse(query.filter) : undefined;
    const audit = await readProjectMemoryAudit(createRuntimeRepository({ tenantId, bankId }), { scope: { tenantId, bankId }, projectId: query.projectId, filter, captureGaps: ['Cross-platform capture is only available where an export or connector is supplied.'] });
    return NextResponse.json({ ok: true, data: { audit, capture: getCaptureStatus() } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid audit query' : error instanceof Error ? error.message : 'audit read failed';
    const status = message.includes('credential') ? 401 : 400;
    return NextResponse.json({ ok: false, error: message, data: { capture: getCaptureStatus() } }, { status });
  }
}
