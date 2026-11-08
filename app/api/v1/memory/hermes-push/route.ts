import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { watcherStatus } from '../../../../../lib/server/watcher-loop';
import { saveDistilledFacts } from '../../../../../lib/server/pg-lifecycle';
import {
  parsePushBody,
  bankIdForCwd,
  findBankForCwd,
  pushTranscript,
} from '../../../../../lib/server/hermes-push';

// The push endpoint routes itself (cwd → bank), so callers don't carry a
// project scope. Fall back to the sandbox scope when none is supplied.
async function scopeOrDefault(request: Request) {
  try {
    return await readProjectScope(request);
  } catch {
    return { tenantId: 'sandbox-tenant', bankId: 'push-inbox', projectId: 'hermes-push' };
  }
}

// POST { cwd, sessionId, messages: [{ role, content, timestamp }], bankName? }
// → matches cwd to a bank, creates one when needed, stores the transcript.
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await scopeOrDefault(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', scope);

    const body = await request.json().catch(() => ({}));
    const push = parsePushBody(body);
    const tenantId = String(scope.tenantId ?? 'sandbox-tenant');

    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json({ ok: true, state: 'localStorage-only', data: { bankId: null, imported: 0 } });
    }
    await ensureSchema();

    const { rows } = await pool.query(
      `SELECT bank_id, provenance FROM evidence WHERE tenant_id = $1 AND source = 'bank-watch-path'`,
      [tenantId]
    ).catch(() => ({ rows: [] as never[] }));
    const known = (rows as { bank_id: string; provenance: unknown }[]).map((r) => {
      let cwd = '';
      try {
        const p = typeof r.provenance === 'string' ? JSON.parse(r.provenance) : r.provenance;
        cwd = String((p as { cwd?: string }).cwd ?? '');
      } catch { cwd = ''; }
      return { bankId: String(r.bank_id), cwdKey: cwd };
    });
    let bankId = findBankForCwd(known, push.cwd);
    let created = false;
    if (!bankId) {
      bankId = push.bankName
        ? push.bankName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : bankIdForCwd(push.cwd);
      created = true;
    }

    const transcript = pushTranscript(push.sessionId, push.messages, 0);
    if (!transcript) {
      return NextResponse.json({ ok: true, data: { bankId, created, imported: 0 } });
    }
    await saveDistilledFacts(pool, tenantId, bankId, [
      {
        entity: bankId,
        category: 'workflow',
        content: transcript.slice(0, 4000),
        confidence: 0.7,
        importance: 60,
        occurrences: 1,
        provenance: { source: 'hermes-push', turnId: push.sessionId, createdAt: Date.now() },
      },
    ]);
    if (created) {
      await pool.query(
        `INSERT INTO evidence (id, tenant_id, bank_id, source, content, provenance, created_at)
         VALUES ($1, $2, $3, 'bank-watch-path', $4, $5, NOW())
         ON CONFLICT (tenant_id, bank_id, id) DO NOTHING`,
        [`watch-${bankId}`, tenantId, bankId, push.cwd, JSON.stringify({ path: push.cwd, cwd: push.cwd, at: Date.now() })]
      );
    }
    await pool.query(
      `INSERT INTO evidence (id, tenant_id, bank_id, source, content, provenance, created_at)
       VALUES ($1, $2, $3, 'hermes-push-receipt', $4, $5, NOW())
       ON CONFLICT (tenant_id, bank_id, id) DO UPDATE SET content = EXCLUDED.content, provenance = EXCLUDED.provenance, created_at = NOW()`,
      [`hermes-push-${bankId}`, tenantId, bankId,
        JSON.stringify({ at: Date.now(), sessionId: push.sessionId, messages: push.messages.length }),
        JSON.stringify({ source: 'hermes-push', sessionId: push.sessionId, at: Date.now() })]
    );
    const latest = Math.max(...push.messages.map((m) => m.timestamp));
    return NextResponse.json({ ok: true, data: { bankId, created, imported: push.messages.length, latest } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'push failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: true });
  }
}

// GET → connection status for the one-click Connect button.
export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await scopeOrDefault(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:read', scope);
    const tenantId = String(scope.tenantId ?? 'sandbox-tenant');
    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json({ ok: true, data: { connected: true, store: 'localStorage-only', banks: 0, lastPush: null, watcher: watcherStatus() } });
    }
    await ensureSchema();
    const banks = await pool.query(`SELECT COUNT(*)::int AS n FROM banks WHERE tenant_id = $1`, [tenantId]).catch(() => ({ rows: [{ n: 0 }] }));
    const last = await pool.query(
      `SELECT content, created_at FROM evidence WHERE tenant_id = $1 AND source = 'hermes-push-receipt' ORDER BY created_at DESC LIMIT 1`,
      [tenantId]
    ).catch(() => ({ rows: [] as never[] }));
    const row = (last.rows as { content: string; created_at: string }[])[0];
    return NextResponse.json({
      ok: true,
      data: {
        connected: true,
        store: 'postgres',
        banks: Number((banks.rows as { n: number }[])[0]?.n ?? 0),
        lastPush: row ? { ...JSON.parse(String(row.content)), at: row.created_at } : null,
        watcher: watcherStatus(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'status failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: true });
  }
}
