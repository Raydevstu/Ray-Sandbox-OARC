import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { loadDistilledFacts, saveDistilledFacts } from '../../../../../lib/server/pg-lifecycle';
import { supersedeFacts, decayScores } from '../../../../../lib/engine/memory-lifecycle';

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
    const bankId = String(body?.bankId ?? scope.bankId ?? 'default');

    const before = await loadDistilledFacts(pool, bankId, 500);
    const afterSupersede = supersedeFacts(before);
    const afterDecay = decayScores(afterSupersede, Date.now());
    await saveDistilledFacts(pool, bankId, afterDecay);

    return NextResponse.json({
      ok: true,
      data: { bankId, before: before.length, after: afterDecay.length, removed: before.length - afterDecay.length },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'consolidate request failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: true });
  }
}
