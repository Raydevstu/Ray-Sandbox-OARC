import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { enqueue, drain, statusOf, type JobKind } from '../../../../../lib/server/job-queue';
import { getPgPool } from '../../../../../lib/server/pg-client';

const KINDS: JobKind[] = ["workflow", "replay", "evaluate", "trace", "import"];

// POST { bankId, kind, payload } → enqueues background work, returns jobId immediately.
export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await readProjectScope(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', scope);

    const body = await request.json().catch(() => ({}));
    const kind = String(body?.kind ?? "") as JobKind;
    if (!KINDS.includes(kind)) {
      return apiFailure(requestId, `invalid job kind: ${kind}`, 'failed', 400);
    }
    const tenantId = String(scope.tenantId ?? 'sandbox-tenant');
    const bankId = String(body?.bankId ?? scope.bankId ?? 'default');
    const job = enqueue(tenantId, bankId, kind, (body?.payload ?? {}) as Record<string, unknown>);

    const pool = getPgPool();
    if (pool) {
      drain(
        (t, p) => pool.query(t, p),
        async (k, payload) => ({ ok: true, kind: k, payload, at: Date.now() })
      ).catch((e) => console.warn("job drain failed:", e));
    }
    return NextResponse.json({ ok: true, data: { jobId: job.id, kind, status: job.status } }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'job enqueue failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: true });
  }
}

// GET ?jobId= → job status.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const job = statusOf(url.searchParams.get('jobId') ?? '');
    if (!job) return NextResponse.json({ ok: false, error: 'job not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: job });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'job status failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
