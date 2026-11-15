import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { createRecallHandler } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '../../../../../lib/runtime/repository';
import { createRecallProfiler } from '../../../../../lib/runtime/recall-profiling';
import { createRecallScheduler, recallConcurrencyFromEnv } from '../../../../../lib/runtime/recall-scheduler';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { saveDecisionTrace } from '../../../../../lib/server/pg-lifecycle';
import { recordTrace } from '../../../../../lib/engine/decision-trace';
import { rankBankFacts } from '../../../../../lib/server/recall-rank';
import { bankIdForCwd, findBankForCwd } from '../../../../../lib/server/hermes-push';

const recallScheduler = createRecallScheduler(recallConcurrencyFromEnv(process.env));

async function resolveRecallScope(principal: { tenantId: string; bankId?: string; projectId?: string }, body: Record<string, unknown>, pool: ReturnType<typeof getPgPool> | null) {
  const tenantId = String(body.tenantId ?? principal.tenantId ?? '');
  const requestedBankId = typeof body.bankId === 'string' ? body.bankId : undefined;
  const requestedProjectId = typeof body.projectId === 'string' ? body.projectId : undefined;
  const workspacePath = typeof body.workspacePath === 'string' ? body.workspacePath : undefined;

  let derivedBankId: string | undefined;
  if (workspacePath && pool) {
    try {
      await ensureSchema();
      const { rows } = await pool.query(
        `SELECT bank_id, provenance FROM evidence WHERE tenant_id = $1 AND source = 'bank-watch-path'`,
        [tenantId],
      ).catch(() => ({ rows: [] as never[] }));
      const known = (rows as { bank_id: string; provenance: unknown }[]).map((r) => {
        let cwd = '';
        try {
          const p = typeof r.provenance === 'string' ? JSON.parse(r.provenance) : r.provenance;
          cwd = String((p as { cwd?: string }).cwd ?? '');
        } catch { cwd = ''; }
        return { bankId: String(r.bank_id), cwdKey: cwd };
      });
      derivedBankId = findBankForCwd(known, workspacePath) ?? bankIdForCwd(workspacePath);
    } catch {
      derivedBankId = bankIdForCwd(workspacePath);
    }
  } else if (workspacePath) {
    derivedBankId = bankIdForCwd(workspacePath);
  }

  const enforcedBankId = principal.bankId ?? derivedBankId ?? requestedBankId;
  const enforcedProjectId = principal.projectId ?? requestedProjectId;

  // Tamper/hint conflict: client explicitly asked for a bank outside principal's
  // allowed/bound scope -> no cross-project facts (return empty, not 403) per Task 11.
  const tamperedBank = Boolean(principal.bankId && requestedBankId && requestedBankId !== principal.bankId);
  const tamperedDerived = Boolean(principal.bankId && derivedBankId && derivedBankId !== principal.bankId);

  return {
    tenantId,
    bankId: enforcedBankId ?? requestedBankId ?? derivedBankId ?? 'default',
    projectId: enforcedProjectId,
    tampered: tamperedBank || tamperedDerived,
  };
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const profiler = createRecallProfiler(process.env.APEX_PROFILE_RECALL === 'true');
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    profiler.mark('auth');
    const rawBody = await request.clone().json().catch(() => ({} as Record<string, unknown>));
    const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;

    const pool = getPgPool();
    const resolved = await resolveRecallScope(principal as any, body, pool);
    const scope = {
      tenantId: resolved.tenantId,
      bankId: resolved.bankId,
      ...(resolved.projectId ? { projectId: resolved.projectId } : {}),
    };
    profiler.mark('scope');

    // Enforce against resolved scope; for tampered recall hints return empty (no leak).
    if (resolved.tampered) {
      authorize(principal, 'memory:read', { tenantId: resolved.tenantId, bankId: principal.bankId ?? resolved.bankId, projectId: principal.projectId ?? resolved.projectId } as any);
      return NextResponse.json({ ok: true, data: { facts: [], traceId: `recall-${Date.now()}` } });
    }
    authorize(principal, 'memory:read', scope as any);
    if (scope.projectId) {
      try {
        const { authorizeProject } = await import('../../../../../lib/runtime/auth');
        (authorizeProject as any)(principal, scope);
      } catch {
        // best-effort: dev principals may carry projectId without allow-list semantics in all modes
      }
    }
    profiler.mark('authorize');

    if (pool) {
      try {
        await ensureSchema();
        const tenantId = String(resolved.tenantId ?? 'sandbox-tenant');
        const bankId = String(resolved.bankId ?? 'default');
        const query = String(body?.query ?? '');
        const limit = typeof body?.limit === 'number' ? body.limit : (typeof body?.maxTokens === 'number' ? Math.floor(body.maxTokens / 100) : 20);
        const { rows } = await pool.query(
          `SELECT f.entity, f.category, f.claim AS content, f.confidence, f.importance, f.occurrences
           FROM facts f WHERE f.tenant_id = $1 AND f.bank_id = $2
             AND NOT EXISTS (SELECT 1 FROM deleted_facts d WHERE d.tenant_id = f.tenant_id AND d.bank_id = f.bank_id AND d.fact_id = f.id)
           ORDER BY f.importance DESC LIMIT 200`,
          [tenantId, bankId]
        );
        const ranked = rankBankFacts(query, rows as never[], limit);
        try {
          const trace = recordTrace({
            query,
            task: `pg-recall:${bankId}`,
            pack: { task: bankId, architectureFacts: ranked.map((f) => f.content), previousSolutions: [], relevantFiles: [], dependencies: [], risks: [], facts: ranked, tokensUsed: ranked.length * 25 },
            model: 'pg',
            tokens: ranked.length * 25,
          });
          await saveDecisionTrace(pool, tenantId, bankId, trace);
        } catch (traceError) {
          console.warn('decision trace write failed (recall unaffected):', traceError);
        }
        return NextResponse.json({ ok: true, data: { facts: ranked, traceId: `pg-${Date.now()}` } });
      } catch (pgError) {
        console.warn('PostgreSQL unavailable, falling back to localStorage:', pgError);
      }
    }

    if (!isRuntimeStoreConfigured()) {
      return NextResponse.json({ ok: true, state: "localStorage-only" });
    }
    return await recallScheduler.run(async () => {
      profiler.mark('queue');
      // Enforce resolved scope for fallback path by injecting it into the request body.
      const enforcedBody = { ...body, tenantId: resolved.tenantId, bankId: resolved.bankId, ...(resolved.projectId ? { projectId: resolved.projectId } : {}) };
      const enforcedRequest = new Request(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(enforcedBody) });
      const repository = createRuntimeRepository({ tenantId: resolved.tenantId, bankId: resolved.bankId } as any, profiler);
      profiler.mark('repository');
      return createRecallHandler(repository, profiler)(enforcedRequest);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'recall request failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400;
    return apiFailure(requestId, message, status === 401 || status === 403 ? 'unauthorized' : 'failed', status, { retryable: false });
  }
}
