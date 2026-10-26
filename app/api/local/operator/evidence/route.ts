import { NextResponse } from 'next/server';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { checkRuntimeStore, createRuntimeRepository } from '@/lib/runtime/repository';
import { readLocalOperatorSession } from '@/lib/runtime/local-operator';
import { buildRetrievalTrace } from '@/lib/runtime/retrieval-trace';
import type { OperationalState } from '@/lib/runtime/operational-state';

const stateForCount = (count: number): OperationalState => count === 0 ? 'empty' : 'healthy';

export async function GET(request: Request) {
  const runtime = parseRuntimeConfig(process.env);
  const session = readLocalOperatorSession(runtime, request);
  if (!session) return NextResponse.json({ ok: false, state: 'unauthorized', error: 'local operator session required' }, { status: 401 });

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const storeState = await checkRuntimeStore();
  if (storeState !== 'healthy') return NextResponse.json({ ok: false, requestId, state: 'unavailable', error: `canonical store is ${storeState}`, retryable: true, data: { scopeId: session.scopeId } }, { status: 503 });

  try {
    if (!session.bankId || !session.projectId) return NextResponse.json({ ok: false, requestId, state: 'failed', error: 'local operator session scope is incomplete' }, { status: 500 });
    const scope = { tenantId: session.tenantId, bankId: session.bankId };
    const repository = createRuntimeRepository(scope);
    const [events, records, conflicts, policies, runs, corrections, comparisons, replays] = await Promise.all([
      repository.listProjectEvents(scope, session.projectId),
      repository.listProjectMemory(scope, session.projectId),
      repository.listGraphConflicts(scope),
      repository.listMemoryPolicies(scope, session.projectId, 100),
      repository.listEvaluationRuns(scope, session.projectId, 100),
      repository.listEvaluationCorrections(scope, session.projectId, 100),
      repository.listReplayComparisons(scope, session.projectId, 100),
      repository.listWorkflowReplays(scope, session.projectId, 100),
    ]);
    const trace = buildRetrievalTrace(records, 'operator evidence');
    return NextResponse.json({
      ok: true,
      requestId,
      state: 'healthy',
      data: {
        scope: { scopeId: session.scopeId, label: session.label, tenantId: session.tenantId, bankId: session.bankId, projectId: session.projectId },
        health: { state: 'healthy', canonicalStore: storeState },
        events: { state: stateForCount(events.length), count: events.length },
        trace: { state: stateForCount(trace.items.length), count: trace.items.length, gaps: trace.gaps.length, rationales: trace.items.slice(0, 5).map((item) => item.rationale) },
        conflicts: { state: stateForCount(conflicts.length), count: conflicts.length },
        policies: { state: stateForCount(policies.length), count: policies.length },
        evaluations: { state: stateForCount(runs.length), runs: runs.length, corrections: corrections.length, comparisons: comparisons.length },
        replays: { state: stateForCount(replays.length), count: replays.length, completed: replays.filter((replay) => replay.status === 'complete').length },
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, requestId, state: 'failed', error: error instanceof Error ? error.message : 'operator evidence read failed' }, { status: 500 });
  }
}
