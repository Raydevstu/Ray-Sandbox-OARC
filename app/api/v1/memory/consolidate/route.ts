import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { ensureSchedulerBooted } from '../../../../../lib/server/scheduler-boot';
import { startWatcherLoop, watcherStatus } from '../../../../../lib/server/watcher-loop';
import { loadDistilledFacts, saveDistilledFacts, loadDecisionTraces } from '../../../../../lib/server/pg-lifecycle';
import { supersedeFacts, decayScores } from '../../../../../lib/engine/memory-lifecycle';
import { scoreSkills, applySkillWeights } from '../../../../../lib/engine/skill-score';

// Nightly worker endpoint: load distilled facts for a bank, collapse
// superseded pairs, apply decay, save back. Safe to run on a schedule.
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await readProjectScope(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', scope);

    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json({ ok: true, state: 'localStorage-only', consolidated: 0 });
    }
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const tenantId = String(scope.tenantId ?? 'sandbox-tenant');
    const bankId = String(body?.bankId ?? scope.bankId ?? 'default');
    ensureSchedulerBooted(tenantId, bankId);
    if (process.env.APEX_WATCHER !== "false") startWatcherLoop();

    const before = await loadDistilledFacts(pool, tenantId, bankId, 500);
    const afterSupersede = supersedeFacts(before);
    const afterDecay = decayScores(afterSupersede, Date.now());
    await saveDistilledFacts(pool, tenantId, bankId, afterDecay);

    let skillWeights: Record<string, number> = {};
    try {
      const traces = await loadDecisionTraces(pool, tenantId, bankId, 200);
      skillWeights = applySkillWeights(scoreSkills(traces), {});
    } catch (w) {
      console.warn("skill weight refresh failed (consolidation unaffected):", w);
    }

    return NextResponse.json({
      ok: true,
      data: { bankId, before: before.length, after: afterDecay.length, removed: before.length - afterDecay.length, skillWeights, watcher: watcherStatus() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'consolidate request failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: true });
  }
}
