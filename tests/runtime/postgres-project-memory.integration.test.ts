import { describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PostgresRepository } from '../../lib/runtime/repositories/postgres';
import { ProjectMemoryPipeline } from '../../lib/runtime/project-memory-pipeline';
import { replayProjectMemory } from '../../lib/runtime/project-memory';
import { createProjectJob } from '../../lib/runtime/project-worker';

const url = process.env.APEX_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('live PostgreSQL project-memory pipeline', () => {
  it('persists source events, governed records, and replayable memory events', async () => {
    const pool = new Pool({ connectionString: url });
    const scope = { tenantId: 'pipeline-integration-tenant', bankId: 'pipeline-integration-bank' };
    const projectId = `pipeline-${Date.now()}`;
    try {
      await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW()) ON CONFLICT DO NOTHING', [scope.tenantId]);
      await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING', [scope.bankId, scope.tenantId]);
      const repository = new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
      const source = { tenantId: scope.tenantId, bankId: scope.bankId, id: `source-${projectId}`, projectId, type: 'CodexConversationMessage', payload: { conversation: { ...scope, projectId, platform: 'codex', conversationId: 'live-c1', messageId: 'live-m1', role: 'user', content: 'Decision: use PostgreSQL for durable project memory.', timestamp: new Date().toISOString() } }, occurredAt: new Date().toISOString(), sequence: 1 } as const;
      await repository.appendProjectEvent(source);
      const pipeline = new ProjectMemoryPipeline(repository, scope, { consumer: 'live-integration', maxQueue: 4, concurrency: 1, maxAttempts: 1 });
      pipeline.enqueue(source);
      const result = await pipeline.run();
      const records = await repository.listProjectMemory(scope, projectId);
      const events = await repository.listProjectEvents(scope, projectId);
      expect(result.telemetry.processed).toBe(1);
      expect(records).toHaveLength(1);
      expect(events.some((event) => event.type === 'ProjectMemoryRecorded')).toBe(true);
      expect(Object.keys(replayProjectMemory(events).records)).toEqual([records[0].id]);
    } finally { await pool.query('DELETE FROM project_memory_records WHERE tenant_id = $1 AND bank_id = $2 AND project_id = $3', [scope.tenantId, scope.bankId, projectId]); await pool.query('DELETE FROM project_events WHERE tenant_id = $1 AND bank_id = $2 AND project_id = $3', [scope.tenantId, scope.bankId, projectId]); await pool.end(); }
  });

  it('claims a job exclusively and recovers it after its lease expires', async () => {
    const pool = new Pool({ connectionString: url });
    const scope = { tenantId: `worker-claim-${Date.now()}`, bankId: 'bank' };
    const projectId = 'project';
    const event = { tenantId: scope.tenantId, bankId: scope.bankId, id: 'event-claim', projectId, type: 'RepositoryEvidenceCaptured', payload: { source: 'test' }, occurredAt: new Date().toISOString(), sequence: 1 } as const;
    try {
      await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW())', [scope.tenantId]);
      await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW())', [scope.bankId, scope.tenantId]);
      const repository = new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
      await repository.appendProjectEvent(event);
      await repository.enqueueProjectJob(createProjectJob(event, '2000-01-01T00:00:00.000Z'));
      const [first, second] = await Promise.all([
        repository.claimProjectJobs(scope, 'worker-a', 1, 60_000),
        repository.claimProjectJobs(scope, 'worker-b', 1, 60_000),
      ]);
      expect(first.length + second.length).toBe(1);
      const claimed = first[0] ?? second[0];
      expect(claimed?.attempts).toBe(1);
      await pool.query('UPDATE jobs SET lease_until = NOW() - INTERVAL \'1 second\' WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      const recovered = await repository.claimProjectJobs(scope, 'worker-restarted', 1, 60_000);
      expect(recovered).toHaveLength(1);
      expect(recovered[0]?.attempts).toBe(2);
    } finally {
      await pool.query('DELETE FROM jobs WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM project_events WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM banks WHERE tenant_id = $1', [scope.tenantId]);
      await pool.query('DELETE FROM tenants WHERE id = $1', [scope.tenantId]);
      await pool.end();
    }
  });

  it('persists retry and dead-letter state across fresh repository instances', async () => {
    const pool = new Pool({ connectionString: url });
    const scope = { tenantId: `worker-retry-${Date.now()}`, bankId: 'bank' };
    const event = { tenantId: scope.tenantId, bankId: scope.bankId, id: 'event-retry', projectId: 'project', type: 'TestEvidenceCaptured', payload: {}, occurredAt: new Date().toISOString(), sequence: 1 } as const;
    try {
      await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW())', [scope.tenantId]);
      await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW())', [scope.bankId, scope.tenantId]);
      const makeRepository = () => new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
      const firstRepository = makeRepository();
      await firstRepository.appendProjectEvent(event);
      await firstRepository.enqueueProjectJob(createProjectJob(event, '2000-01-01T00:00:00.000Z'));
      const firstClaim = (await firstRepository.claimProjectJobs(scope, 'worker-before-restart', 1, 60_000))[0];
      expect(firstClaim).toBeDefined();
      expect(await makeRepository().failProjectJob(scope, firstClaim!.id, 'worker-before-restart', 'first failure', 3, '2000-01-01T00:00:00.000Z')).toBe('pending');
      const secondRepository = makeRepository();
      const secondClaim = (await secondRepository.claimProjectJobs(scope, 'worker-after-restart', 1, 60_000))[0];
      expect(secondClaim?.attempts).toBe(2);
      expect(await secondRepository.failProjectJob(scope, secondClaim!.id, 'worker-after-restart', 'second failure', 2, new Date().toISOString())).toBe('dead-letter');
      const row = (await pool.query('SELECT status, attempts, last_error FROM jobs WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId])).rows[0];
      expect(row).toMatchObject({ status: 'dead-letter', attempts: 2, last_error: 'second failure' });
    } finally {
      await pool.query('DELETE FROM jobs WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM project_events WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM banks WHERE tenant_id = $1', [scope.tenantId]);
      await pool.query('DELETE FROM tenants WHERE id = $1', [scope.tenantId]);
      await pool.end();
    }
  });

  it('replays a dead-letter job and completes it durably after a worker restart', async () => {
    const pool = new Pool({ connectionString: url });
    const scope = { tenantId: `worker-replay-${Date.now()}`, bankId: 'bank' };
    const event = { tenantId: scope.tenantId, bankId: scope.bankId, id: 'event-replay', projectId: 'project', type: 'TestEvidenceCaptured', payload: {}, occurredAt: new Date().toISOString(), sequence: 1 } as const;
    try {
      await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW())', [scope.tenantId]);
      await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW())', [scope.bankId, scope.tenantId]);
      const repository = new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
      await repository.appendProjectEvent(event);
      await repository.enqueueProjectJob(createProjectJob(event, '2000-01-01T00:00:00.000Z'));
      const claim = (await repository.claimProjectJobs(scope, 'worker-failing', 1, 60_000))[0];
      expect(claim).toBeDefined();
      expect(await repository.failProjectJob(scope, claim!.id, 'worker-failing', 'forced replay test failure', 1, new Date().toISOString())).toBe('dead-letter');
      expect(await repository.replayDeadLetterJob(scope, claim!.id, '2000-01-01T00:00:00.000Z')).toBe(true);
      const replayed = (await repository.claimProjectJobs(scope, 'worker-restarted', 1, 60_000))[0];
      expect(replayed?.eventId).toBe(event.id);
      await repository.completeProjectJob(scope, replayed!.id, 'worker-restarted');
      const row = (await pool.query('SELECT status FROM jobs WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId])).rows[0];
      expect(row.status).toBe('complete');
    } finally {
      await pool.query('DELETE FROM jobs WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM project_events WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM banks WHERE tenant_id = $1', [scope.tenantId]);
      await pool.query('DELETE FROM tenants WHERE id = $1', [scope.tenantId]);
      await pool.end();
    }
  });

  it('persists benchmark runs across fresh repository instances', async () => {
    const pool = new Pool({ connectionString: url });
    const scope = { tenantId: `benchmark-${Date.now()}`, bankId: 'bank' };
    const run = { id: `run-${Date.now()}`, generatedAt: new Date().toISOString(), corpusId: 'golden-v1', modelId: 'integration-test', promptVersion: 'p1', evidence: 'replay', cases: [{ caseId: 'case-1', mode: 'without-memory', answerScore: 0, citationPrecision: 0, unsupportedClaimRate: 0, latencyMs: 1, retrievalLatencyMs: 0, queueDelayMs: 0, persisted: false, captureStatus: 'uncaptured' }] } as const;
    try {
      await pool.query('INSERT INTO tenants (id, created_at) VALUES ($1, NOW())', [scope.tenantId]);
      await pool.query('INSERT INTO banks (id, tenant_id, created_at) VALUES ($1, $2, NOW())', [scope.bankId, scope.tenantId]);
      const makeRepository = () => new PostgresRepository(async (query, params) => (await pool.query(query, [...params])).rows, scope);
      await makeRepository().saveBenchmarkRun(scope, 'project', run);
      await expect(makeRepository().listBenchmarkRuns(scope, 'project', 10)).resolves.toEqual([run]);
    } finally {
      await pool.query('DELETE FROM project_benchmark_runs WHERE tenant_id = $1 AND bank_id = $2', [scope.tenantId, scope.bankId]);
      await pool.query('DELETE FROM banks WHERE tenant_id = $1', [scope.tenantId]);
      await pool.query('DELETE FROM tenants WHERE id = $1', [scope.tenantId]);
      await pool.end();
    }
  });
});
