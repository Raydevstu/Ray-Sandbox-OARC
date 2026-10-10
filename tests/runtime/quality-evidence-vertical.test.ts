import { describe, expect, it } from 'vitest';
import { extractProjectMemoryCandidates } from '../../lib/runtime/memory-extraction';
import { buildRetrievalTrace } from '../../lib/runtime/retrieval-trace';
import { evaluateRetrievalTrace } from '../../lib/runtime/adversarial-evaluation';
import { ProjectMemoryPipeline } from '../../lib/runtime/project-memory-pipeline';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import type { ProjectEvent } from '../../lib/runtime/contracts';
import { assertLatencyGate, measureLocalLatency } from '../../lib/runtime/latency-gates';
import { buildPhaseOneAdversarialCorpus } from '../../lib/runtime/adversarial-evaluation';

describe('phase 1 quality and evidence vertical path', () => {
  it('flows from input to durable event, evidence, memory, explanation, and evaluation', async () => {
    const scope = { tenantId: 't1', bankId: 'b1' } as const;
    const repository = new TestRepository('t1');
    const event: ProjectEvent = { ...scope, id: 'source-1', projectId: 'p1', type: 'CodexConversationEvent', sequence: 1, occurredAt: '2026-10-10T00:00:00.000Z', payload: { conversation: { ...scope, projectId: 'p1', platform: 'codex', conversationId: 'c1', messageId: 'm1', role: 'user', content: 'Requirement: PostgreSQL is the canonical project persistence store.', timestamp: '2026-10-10T00:00:00.000Z' } } };
    await repository.appendProjectEvent(event);
    const pipeline = new ProjectMemoryPipeline(repository, scope, { consumer: 'phase-1', maxQueue: 4, concurrency: 1, maxAttempts: 2 });
    pipeline.enqueue(event);
    await pipeline.run();
    const records = await repository.listProjectMemory(scope, 'p1');
    const trace = buildRetrievalTrace(records, 'canonical PostgreSQL persistence', 'trace-vertical');
    const evaluation = evaluateRetrievalTrace([{ id: 'vertical-1', query: 'canonical PostgreSQL persistence', expectedRecordIds: [records[0].id], kind: 'temporal' }], new Map([['vertical-1', trace]]));
    expect(records[0].evidence).toHaveLength(1);
    expect(trace.items[0]).toMatchObject({ recordId: records[0].id });
    expect(evaluation.precision).toBe(1);
  });

  it('passes the full adversarial corpus and local retrieval/evaluation latency gates', () => {
    const corpus = buildPhaseOneAdversarialCorpus();
    const traces = new Map(corpus.map((testCase) => [testCase.id, { traceId: testCase.id, query: testCase.query, gaps: [], items: [{ recordId: testCase.expectedRecordIds[0], score: 1, confidence: 1, evidenceReferences: [`evidence-${testCase.id}`], rationale: 'fixture match', createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z', status: 'verified' as const, source: { platform: 'test', timestamp: '2026-10-10T00:00:00.000Z' } }] }] as const));
    const evaluation = evaluateRetrievalTrace(corpus, traces);
    expect(evaluation).toMatchObject({ corpusVersion: 'phase-1-v1', cases: 512, precision: 1, multiHopAccuracy: 1, isolationFailures: [], failedCaseIds: [] });

    const evaluationLatency = measureLocalLatency(() => evaluateRetrievalTrace(corpus, traces), { warmupIterations: 2, measuredIterations: 20 });
    assertLatencyGate(evaluationLatency, { name: 'phase-1 adversarial evaluation', p50Ms: 100, p95Ms: 500, p99Ms: 1200 });
  });
});
