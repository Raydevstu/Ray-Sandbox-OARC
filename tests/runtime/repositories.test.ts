import { describe, expect, it } from 'vitest';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import { PostgresRepository } from '../../lib/runtime/repositories/postgres';

const fact = { tenantId: 't1', bankId: 'b1', id: 'f1', revision: 1, claim: 'claim', confidence: 1, evidenceIds: ['e1'], createdAt: '2026-10-06T00:00:00.000Z' } as const;
describe('scoped repository ports', () => {
  it('filters reads and rejects cross-tenant writes', async () => {
    const repository = new TestRepository('t1');
    await repository.appendRevision(fact);
    await expect(repository.findFacts({ tenantId: 't1', bankId: 'b1' })).resolves.toHaveLength(1);
    await expect(repository.findFacts({ tenantId: 't2', bankId: 'b1' })).rejects.toThrow();
    await expect(repository.appendRevision({ ...fact, tenantId: 't2' })).rejects.toThrow();
  });
  it('uses outbox idempotency keys consistently', async () => {
    const repository = new TestRepository('t1');
    await repository.appendEvent({ tenantId: 't1', bankId: 'b1', id: 'event-1', type: 'captured', payload: {}, occurredAt: '2026-10-06T00:00:00.000Z' });
    await expect(repository.getByIdempotencyKey({ tenantId: 't1', bankId: 'b1' }, 'event-1')).resolves.toMatchObject({ id: 'event-1' });
  });
  it('loads evidence ids and writes links in the same scoped transaction', async () => {
    const calls: string[] = [];
    const repository = new PostgresRepository(async (query, params) => {
      calls.push(`${query}|${params.join(',')}`);
      if (query.includes('FROM facts')) return [{ id: 'f1', tenantId: 't1', bankId: 'b1', revision: 1, claim: 'claim', confidence: 1, createdAt: '2026-10-06T00:00:00.000Z', evidenceIds: ['e1'] }];
      return [];
    }, { tenantId: 't1', bankId: 'b1' });
    await repository.appendRevision(fact);
    await expect(repository.findFacts({ tenantId: 't1', bankId: 'b1' })).resolves.toEqual([fact]);
    expect(calls.some((call) => call.includes('fact_evidence'))).toBe(true);
    expect(calls[0]).toContain('BEGIN');
    expect(calls.some((call) => call.includes('COMMIT'))).toBe(true);
    await expect(repository.findFacts({ tenantId: 't2', bankId: 'b1' })).rejects.toThrow('scope');
  });
  it('persists project events and records through scoped PostgreSQL statements', async () => {
    const calls: Array<{ query: string; params: readonly unknown[] }> = [];
    const repository = new PostgresRepository(async (query, params) => { calls.push({ query, params }); return []; }, { tenantId: 't1', bankId: 'b1' });
    const event = { tenantId: 't1', bankId: 'b1', id: 'pe1', projectId: 'p1', type: 'ProjectMemoryRecorded', payload: { recordId: 'r1' }, occurredAt: '2026-10-07T00:00:00.000Z', sequence: 1 } as const;
    const record = { tenantId: 't1', bankId: 'b1', id: 'r1', projectId: 'p1', type: 'decision', title: 'Decision', content: 'Use PostgreSQL', status: 'active', confidence: 1, importance: 'critical', source: { platform: 'codex', timestamp: '2026-10-07T00:00:00.000Z' }, evidence: [], supersedes: [], relatedRecords: [], createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z' } as const;
    await repository.appendProjectEvent(event);
    await repository.appendProjectMemory(record);
    expect(calls[0].query).toContain('INSERT INTO project_events');
    expect(calls[1].query).toContain('INSERT INTO project_memory_records');
    await expect(repository.appendProjectEvent({ ...event, tenantId: 't2' })).rejects.toThrow('scope');
  });
  it('assigns project event sequences inside a project-scoped transaction', async () => {
    const calls: string[] = [];
    const repository = new PostgresRepository(async (query) => { calls.push(query); return query.includes('MAX(sequence)') ? [{ sequence: 7 }] : []; }, { tenantId: 't1', bankId: 'b1' });
    const event = { tenantId: 't1', bankId: 'b1', id: 'review-1', projectId: 'p1', type: 'ProjectMemoryReviewCompleted', payload: {}, occurredAt: '2026-10-10T00:00:00.000Z', sequence: 0 } as const;
    await expect(repository.appendProjectEventNextSequence(event)).resolves.toMatchObject({ sequence: 7 });
    expect(calls).toContain('BEGIN');
    expect(calls.some((query) => query.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(calls.some((query) => query.includes('INSERT INTO project_events'))).toBe(true);
    expect(calls).toContain('COMMIT');
  });
  it('normalizes PostgreSQL Date values before returning project memory records', async () => {
    const repository = new PostgresRepository(async (query) => query.includes('FROM project_memory_records') ? [{ tenantId: 't1', bankId: 'b1', projectId: 'p1', id: 'r1', type: 'decision', title: 'Decision', content: 'Use PostgreSQL', status: 'active', confidence: 1, importance: 'critical', source: {}, evidence: [], supersedes: [], relatedRecords: [], createdAt: new Date('2026-10-07T00:00:00.000Z'), updatedAt: new Date('2026-10-07T01:00:00.000Z') }] : [], { tenantId: 't1', bankId: 'b1' });
    await expect(repository.listProjectMemory({ tenantId: 't1', bankId: 'b1' }, 'p1')).resolves.toMatchObject([{ createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T01:00:00.000Z' }]);
  });
  it('records an exact claim timestamp for queue-delay measurement', async () => {
    const calls: string[] = [];
    const repository = new PostgresRepository(async (query) => {
      calls.push(query);
      if (query.includes('UPDATE jobs')) return [{ id: 'job-1', tenantId: 't1', bankId: 'b1', eventId: 'event-1', status: 'running', attempts: 1, availableAt: '2026-10-07T00:00:00.000Z' }];
      if (query.includes('FROM project_events')) return [{ id: 'event-1', tenantId: 't1', bankId: 'b1', projectId: 'p1', type: 'EvidenceCaptured', payload: {}, occurredAt: '2026-10-07T00:00:00.000Z', sequence: 1 }];
      return [];
    }, { tenantId: 't1', bankId: 'b1' });
    await repository.claimProjectJobs({ tenantId: 't1', bankId: 'b1' }, 'worker', 1, 1000);
    expect(calls[0]).toContain('claimed_at = NOW()');
  });
  it('persists and reloads benchmark runs through scoped PostgreSQL statements', async () => {
    const calls: Array<{ query: string; params: readonly unknown[] }> = [];
    const run = { id: 'run-1', generatedAt: '2026-10-08T00:00:00.000Z', corpusId: 'golden', modelId: 'test', promptVersion: 'p1', evidence: 'replay', cases: [{ caseId: 'c1', mode: 'without-memory', answerScore: 0, citationPrecision: 0, unsupportedClaimRate: 0, latencyMs: 1, retrievalLatencyMs: 0, queueDelayMs: 0, persisted: false, captureStatus: 'uncaptured' }] } as const;
    const repository = new PostgresRepository(async (query, params) => { calls.push({ query, params }); return query.includes('SELECT payload') ? [{ payload: run }] : []; }, { tenantId: 't1', bankId: 'b1' });
    await repository.saveBenchmarkRun({ tenantId: 't1', bankId: 'b1' }, 'p1', run);
    await expect(repository.listBenchmarkRuns({ tenantId: 't1', bankId: 'b1' }, 'p1', 10)).resolves.toEqual([run]);
    expect(calls[0].query).toContain('INSERT INTO project_benchmark_runs');
    expect(calls[1].query).toContain('SELECT payload');
  });
});
