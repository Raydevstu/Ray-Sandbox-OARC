import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { getCaptureStatus } from '@/lib/runtime/capture-status';
import { deriveOperationsStatus } from '@/lib/runtime/operations-status';

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const tenantId = process.env.APEX_AUDIT_TENANT_ID ?? '';
    const bankId = process.env.APEX_AUDIT_BANK_ID ?? '';
    if (!tenantId || !bankId || !isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'operations store is not configured' }, { status: 503 });
    const scope = { tenantId, bankId };
    authorize(principal, 'jobs:claim', scope);
    const jobs = await createRuntimeRepository(scope).getProjectJobHealth(scope);
    return NextResponse.json({ ok: true, data: { jobs, capture: getCaptureStatus(), ...deriveOperationsStatus(jobs) } });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'operations read failed' }, { status: 401 }); }
}
