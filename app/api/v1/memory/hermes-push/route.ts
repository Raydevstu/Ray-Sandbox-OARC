import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { watcherStatus } from '../../../../../lib/server/watcher-loop';
import { saveDistilledFacts, deleteChatSessionFacts } from '../../../../../lib/server/pg-lifecycle';
import { upsertSession } from '../../../../../lib/server/session-repository';
import { recordCapture } from '../../../../../lib/runtime/capture-status';
import {
  parsePushBody,
  bankIdForCwd,
  findBankForCwd,
  type ParsedPush,
} from '../../../../../lib/server/hermes-push';
import { structureTranscript } from '../../../../../lib/engine/chat-structure';
import { distillSession } from '../../../../../lib/engine/distillation';
import { redactIncoming } from '../../../../../lib/server/redaction';

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
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const scope = await scopeOrDefault(request);
    const body = await request.json().catch(() => ({}));
    const push = parsePushBody(body);
    const tenantId = String(scope.tenantId ?? 'sandbox-tenant');

    // F10/L3: redact the pushed transcript (defense in depth) before hashing,
    // dedup, and persistence; secret lines are dropped and counted.
    const redacted = redactIncoming(push);
    const redactedPush = redacted.payload as ParsedPush;
    const skipped = redacted.skipped;
    if (skipped > 0) recordCapture('skipped_redaction', redactedPush.sessionId);

    const pool = getPgPool();
    if (!pool) {
      // F2: honest degraded state. Nothing was persisted; success must never be
      // reported against a missing store.
      return apiFailure(requestId, 'memory store is not configured', 'no-store', 503, { retryable: true });
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
    let bankId: string | null = findBankForCwd(known, redactedPush.cwd);
    let created = false;
    if (!bankId) {
      bankId = redactedPush.bankName
        ? redactedPush.bankName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : bankIdForCwd(redactedPush.cwd);
      created = true;
    }
    const resolvedBankId = bankId;

    // F2: authorization runs against the resolved bank scope, not a fallback.
    authorize(principal, 'memory:write', { tenantId, bankId: resolvedBankId, projectId: scope.projectId });

    const facts = structureTranscript(redactedPush.sessionId, redactedPush.messages, resolvedBankId);
    if (facts.length === 0) {
      return NextResponse.json({ ok: true, data: { bankId: resolvedBankId, created, imported: 0 } });
    }
    if (redactedPush.resync) {
      await deleteChatSessionFacts(pool, tenantId, resolvedBankId, redactedPush.sessionId);
    }

    // F3: keep the raw transcript retention-eligible (raw evidence) and distill
    // into governed facts — never store the raw transcript text as a fact.
    const rawContent = redactedPush.messages.map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`).join('\n');
    await pool.query(
      `INSERT INTO evidence (id, tenant_id, bank_id, fact_id, source, content, provenance, created_at)
       VALUES ($1, $2, $3, $4, 'hermes-push', $5, $6, NOW())
       ON CONFLICT (tenant_id, bank_id, id) DO NOTHING`,
      [`hermes-push-raw-${resolvedBankId}-${redactedPush.sessionId}`, tenantId, resolvedBankId, `fact-${resolvedBankId}-${redactedPush.sessionId}`, rawContent, JSON.stringify({ source: 'hermes-push', turnId: redactedPush.sessionId, createdAt: Date.now() })]
    );
    const MAX_FINDING_CHARS = 300;
    const distilled = distillSession({
      task: `chat:${resolvedBankId}`,
      events: facts.map((f) => ({ type: 'CHAT_TURN', timestamp: Date.now(), content: f.content.slice(0, MAX_FINDING_CHARS) })),
      findings: facts.map((f) => f.content.slice(0, MAX_FINDING_CHARS)),
    });
    const stored = distilled.map((d) => ({ ...d, provenance: { source: 'hermes-push', turnId: redactedPush.sessionId, createdAt: Date.now() } }));
    await saveDistilledFacts(pool, tenantId, resolvedBankId, stored);
    if (created) {
      await pool.query(
        `INSERT INTO evidence (id, tenant_id, bank_id, source, content, provenance, created_at)
         VALUES ($1, $2, $3, 'bank-watch-path', $4, $5, NOW())
         ON CONFLICT (tenant_id, bank_id, id) DO NOTHING`,
        [`watch-${resolvedBankId}`, tenantId, resolvedBankId, redactedPush.cwd, JSON.stringify({ path: redactedPush.cwd, cwd: redactedPush.cwd, at: Date.now() })]
      );
    }
    await pool.query(
      `INSERT INTO evidence (id, tenant_id, bank_id, source, content, provenance, created_at)
       VALUES ($1, $2, $3, 'hermes-push-receipt', $4, $5, NOW())
       ON CONFLICT (tenant_id, bank_id, id) DO UPDATE SET content = EXCLUDED.content, provenance = EXCLUDED.provenance, created_at = NOW()`,
      [`hermes-push-${resolvedBankId}`, tenantId, resolvedBankId,
        JSON.stringify({ at: Date.now(), sessionId: redactedPush.sessionId, messages: redactedPush.messages.length }),
        JSON.stringify({ source: 'hermes-push', sessionId: redactedPush.sessionId, at: Date.now() })]
    );
    const latestTs = Math.max(...redactedPush.messages.map((m) => m.timestamp));
    await upsertSession(pool, {
      sessionId: redactedPush.sessionId,
      tenantId,
      bankId: resolvedBankId,
      cwd: redactedPush.cwd,
      lastActivityAt: new Date(latestTs * 1000).toISOString(),
      messageCount: redactedPush.messages.length,
    }).catch(() => {});
    const latest = latestTs;
    return NextResponse.json({ ok: true, data: { bankId: resolvedBankId, created, imported: stored.length, messages: redactedPush.messages.length, latest, categories: [...new Set(stored.map((f) => f.category))] } }, { status: 201 });
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
      // F2: honest degraded state. The dashboard must not read "connected".
      return NextResponse.json({
        ok: false,
        requestId,
        state: 'no-store',
        error: 'memory store is not configured',
        retryable: true,
        data: { connected: false, store: 'no-store', banks: 0, lastPush: null, watcher: watcherStatus() },
      }, { status: 503 });
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
