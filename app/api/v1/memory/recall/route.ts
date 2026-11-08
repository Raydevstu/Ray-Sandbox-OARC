import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { createRecallHandler, readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '../../../../../lib/runtime/repository';
import { createRecallProfiler } from '../../../../../lib/runtime/recall-profiling';
import { createRecallScheduler, recallConcurrencyFromEnv } from '../../../../../lib/runtime/recall-scheduler';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { saveDecisionTrace } from '../../../../../lib/server/pg-lifecycle';
import { recordTrace } from '../../../../../lib/engine/decision-trace';
import { rankBankFacts } from '../../../../../lib/server/recall-rank';

const recallScheduler = createRecallScheduler(recallConcurrencyFromEnv(process.env));

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const profiler = createRecallProfiler(process.env.APEX_PROFILE_RECALL === 'true');
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    profiler.mark('auth');
    const scope = await readProjectScope(request);
    profiler.mark('scope');
    authorize(principal, 'memory:read', scope);
    profiler.mark('authorize');

    const pool = getPgPool();
    if (pool) {
      try {
        await ensureSchema();
        const body = await request.json().catch(() => ({}));
        const tenantId = String(scope.tenantId ?? 'sandbox-tenant');
        const bankId = String(body?.bankId ?? scope.bankId ?? 'default');
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
      const repository = createRuntimeRepository(scope, profiler);
      profiler.mark('repository');
      return createRecallHandler(repository, profiler)(request);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'recall request failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400;
    return apiFailure(requestId, message, status === 401 || status === 403 ? 'unauthorized' : 'failed', status, { retryable: false });
  }
}
