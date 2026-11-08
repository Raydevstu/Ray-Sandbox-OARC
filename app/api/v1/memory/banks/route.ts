import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { ensureSchedulerBooted } from '../../../../../lib/server/scheduler-boot';
import { parseBankBody } from '../../../../../lib/server/bank-create-helper';
import { importOnce } from '../../../../../lib/server/import-worker';

// POST { name, watchPath? } → creates tenant/bank scope, boots the nightly
// scheduler, and runs a first import when a watch path is given.
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await readProjectScope(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', scope);

    const body = await request.json().catch(() => ({}));
    const { name, watchPath } = parseBankBody(body);
    const tenantId = String(scope.tenantId ?? 'sandbox-tenant');
    const bankId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json({ ok: true, state: 'localStorage-only', data: { bankId } });
    }
    await ensureSchema();
    await pool.query(`INSERT INTO tenants (id, created_at) VALUES ($1, NOW()) ON CONFLICT (id) DO NOTHING`, [tenantId]);
    await pool.query(`INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (tenant_id, id) DO NOTHING`, [bankId, tenantId]);
    ensureSchedulerBooted(tenantId, bankId);

    let imported = 0;
    if (watchPath) {
      try {
        const out = await importOnce(pool, tenantId, bankId, watchPath, []);
        imported = out.imported;
      } catch (e) {
        console.warn('initial bank import failed (bank still created):', e);
      }
    }
    return NextResponse.json({ ok: true, data: { bankId, name, watching: !!watchPath, imported } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bank create failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: true });
  }
}
