import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { getPgPool } from '@/lib/server/pg-client';
import { runRetentionSweeper, getRetentionSweeperStatus } from '@/lib/server/retention-sweeper';

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const tenantId = process.env.APEX_AUDIT_TENANT_ID ?? principal.tenantId ?? '';
    const bankId = process.env.APEX_AUDIT_BANK_ID ?? principal.bankId ?? '';
    if (!tenantId || !bankId) return NextResponse.json({ ok: false, error: 'sweeper scope is not configured' }, { status: 503 });
    authorize(principal, 'jobs:claim', { tenantId, bankId } as any);
    const pool = getPgPool();
    if (!pool) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const result = await runRetentionSweeper({ pool: pool as any, tenantId, bankId });
    return NextResponse.json({ ok: true, data: { ...result, status: getRetentionSweeperStatus() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'sweeper run failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    await authenticateRequest(request, parseRuntimeConfig(process.env));
    return NextResponse.json({ ok: true, data: { status: getRetentionSweeperStatus() } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'sweeper status failed' }, { status: 401 });
  }
}