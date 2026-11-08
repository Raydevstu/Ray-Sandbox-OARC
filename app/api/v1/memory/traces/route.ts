import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { loadDecisionTraces, traceAcceptance, setTraceOutcome } from '../../../../../lib/server/pg-lifecycle';

// GET ?bankId= → recent decision traces + acceptance rate (why-included panel data).
export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await readProjectScope(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:read', scope);

    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json({ ok: true, data: { traces: [], acceptance: 0, state: 'localStorage-only' } });
    }
    await ensureSchema();
    const url = new URL(request.url);
    const bankId = url.searchParams.get('bankId') ?? scope.bankId ?? 'default';
    const traces = await loadDecisionTraces(pool, bankId, 20);
    const acceptance = await traceAcceptance(pool, bankId);
    return NextResponse.json({ ok: true, data: { traces, acceptance } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'traces request failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: false });
  }
}

// POST { bankId, id, outcome } → record accept/edit/revert for a trace.
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await readProjectScope(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', scope);

    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json({ ok: true, state: 'localStorage-only' });
    }
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const bankId = String(body?.bankId ?? scope.bankId ?? 'default');
    await setTraceOutcome(pool, bankId, String(body?.id ?? ''), body?.outcome);
    return NextResponse.json({ ok: true, data: { id: body?.id, outcome: body?.outcome } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'trace outcome request failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: false });
  }
}
