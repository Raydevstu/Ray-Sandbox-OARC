import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { ensureSchedulerBooted } from '../../../../../lib/server/scheduler-boot';
import { startWatcherLoop } from '../../../../../lib/server/watcher-loop';
import { parseBankBody } from '../../../../../lib/server/bank-create-helper';
import { importOnce } from '../../../../../lib/server/import-worker';
import { resolveWatchPath, PROJECTS_ROOT } from '../../../../../lib/server/watcher-loop';

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
    if (process.env.APEX_WATCHER !== "false") startWatcherLoop();

    let imported = 0;
    let resolvedPath: string | null = null;
    if (watchPath) {
      resolvedPath = resolveWatchPath(PROJECTS_ROOT, watchPath);
      try {
        if (resolvedPath) {
          const out = await importOnce(pool, tenantId, bankId, resolvedPath, []);
          imported = out.imported;
          await pool.query(
            `INSERT INTO evidence (id, tenant_id, bank_id, source, content, provenance, created_at)
             VALUES ($1, $2, $3, 'bank-watch-path', $4, $5, NOW())
             ON CONFLICT (tenant_id, bank_id, id) DO UPDATE SET content = EXCLUDED.content`,
            [`watch-${bankId}`, tenantId, bankId, resolvedPath, JSON.stringify({ path: resolvedPath, at: Date.now() })]
          );
        }
      } catch (e) {
        console.warn('initial bank import failed (bank still created):', e);
      }
    }
    return NextResponse.json({ ok: true, data: { bankId, name, watching: !!resolvedPath, path: resolvedPath, imported } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bank create failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: true });
  }
}
