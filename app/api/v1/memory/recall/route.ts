import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { createRecallHandler, readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '../../../../../lib/runtime/repository';
import { createRecallProfiler } from '../../../../../lib/runtime/recall-profiling';
import { createRecallScheduler, recallConcurrencyFromEnv } from '../../../../../lib/runtime/recall-scheduler';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';

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
      await ensureSchema();
      const body = await request.json().catch(() => ({}));
      const bankId = String(body?.bankId ?? scope.bankId ?? 'default');
      const scopes = body?.scopes ?? {};
      const limit = typeof body?.limit === 'number' ? body.limit : (typeof body?.maxTokens === 'number' ? Math.floor(body.maxTokens / 100) : 20);
      const result = await pool.query(
        `SELECT * FROM memory_facts WHERE bank_id = $1 AND (scopes->>'userId' = $2 OR $2 IS NULL) ORDER BY mentioned_at DESC LIMIT $3`,
        [bankId, scopes?.userId ?? null, limit]
      );
      return NextResponse.json({ ok: true, data: { facts: result.rows, traceId: `pg-${Date.now()}` } });
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
