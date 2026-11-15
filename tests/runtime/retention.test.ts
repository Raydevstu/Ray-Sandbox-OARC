import { describe, expect, it, vi } from 'vitest';
import { retainMemory } from '../../lib/runtime/retention';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import { PostgresRepository } from '../../lib/runtime/repositories/postgres';
import { runRetentionSweeper } from '../../lib/server/retention-sweeper';

describe('durable retention service', () => {
  it('writes evidence, fact, event, and outbox with provenance', async () => {
    const result = await retainMemory({ tenantId: 't1', bankId: 'b1', content: ' User prefers tea ', source: 'chat', provenance: 'session:s1', idempotencyKey: 'k1' }, new TestRepository('t1'), '2026-10-06T00:00:00.000Z');
    expect(result.fact.evidenceIds).toEqual([result.evidence.id]);
    expect(result.event.type).toBe('MemoryRetained');
    expect(result.replayed).toBe(false);
  });
  it('replays identical idempotency and rejects payload reuse', async () => {
    const repository = new TestRepository('t1');
    const input = { tenantId: 't1', bankId: 'b1', content: 'tea', source: 'chat', provenance: 's1', idempotencyKey: 'k1' };
    await retainMemory(input, repository, '2026-10-06T00:00:00.000Z');
    await expect(retainMemory(input, repository, '2026-10-06T00:00:00.000Z')).resolves.toMatchObject({ replayed: true });
    await expect(retainMemory({ ...input, content: 'coffee' }, repository)).rejects.toThrow('payload conflict');
  });
  it('uses one repository transaction for evidence, fact, ledger, and outbox writes', async () => {
    const statements: string[] = [];
    const repository = new PostgresRepository(async (query) => { statements.push(query); return []; }, { tenantId: 't1', bankId: 'b1' });
    const input = { tenantId: 't1', bankId: 'b1', content: 'tea', source: 'chat', provenance: 's1', idempotencyKey: 'atomic-1' };
    await retainMemory(input, repository, '2026-10-06T00:00:00.000Z');
    const begin = statements.indexOf('BEGIN');
    expect(begin).toBeGreaterThan(-1);
    expect(statements.at(-1)).toBe('COMMIT');
    expect(statements.slice(begin).filter((query) => query.startsWith('INSERT')).length).toBe(5);
  });
});

describe('retention sweeper (Task 12)', () => {
  it('soft-deletes old raw events/evidence, keeps recent and distilled facts, purges after grace, and is no-op on rerun', async () => {
    const now = new Date('2026-11-15T12:00:00.000Z');
    const dayMs = 24 * 60 * 60 * 1000;
    type EvidenceRow = { id: string; tenant_id: string; bank_id: string; source: string; content: string; created_at: Date; deleted_at: Date | null };
    const state: { evidence: EvidenceRow[]; facts: Array<{ id: string; tenant_id: string; bank_id: string; claim: string; created_at: Date }>; backupCalls: number; lockHeld: boolean } = {
      evidence: [
        { id: 'ev-old', tenant_id: 't1', bank_id: 'b1', source: 'hermes-push', content: 'old raw', created_at: new Date(now.getTime() - 91 * dayMs), deleted_at: null },
        { id: 'ev-recent', tenant_id: 't1', bank_id: 'b1', source: 'hermes-push', content: 'recent raw', created_at: new Date(now.getTime() - 89 * dayMs), deleted_at: null },
        { id: 'ev-soft-old', tenant_id: 't1', bank_id: 'b1', source: 'hermes-push', content: 'purge me', created_at: new Date(now.getTime() - 120 * dayMs), deleted_at: new Date(now.getTime() - 31 * dayMs) },
        { id: 'ev-soft-recent', tenant_id: 't1', bank_id: 'b1', source: 'hermes-push', content: 'grace', created_at: new Date(now.getTime() - 120 * dayMs), deleted_at: new Date(now.getTime() - 10 * dayMs) },
      ],
      facts: [
        { id: 'fact-old', tenant_id: 't1', bank_id: 'b1', claim: 'distilled stays', created_at: new Date(now.getTime() - 400 * dayMs) },
      ],
      backupCalls: 0,
      lockHeld: false,
    };

    const pool = {
      query: vi.fn(async (text: string, params?: any[]) => {
        const q = String(text);
        if (q.includes('pg_try_advisory_lock')) {
          if (state.lockHeld) return { rows: [{ pg_try_advisory_lock: false }] };
          state.lockHeld = true;
          return { rows: [{ pg_try_advisory_lock: true }] };
        }
        if (q.includes('pg_advisory_unlock')) {
          state.lockHeld = false;
          return { rows: [{ pg_advisory_unlock: true }] };
        }
        // policy retentionDays lookup (default 90 if absent)
        if (q.toLowerCase().includes('from memory_policies')) {
          return { rows: [] };
        }
        // soft-delete old raw evidence/events
        if (q.toLowerCase().includes('update evidence') && q.toLowerCase().includes('set deleted_at')) {
          let count = 0;
          for (const row of state.evidence) {
            if (!row.deleted_at && row.created_at.getTime() <= now.getTime() - 90 * dayMs) {
              row.deleted_at = now;
              count += 1;
            }
          }
          return { rows: [], rowCount: count };
        }
        // hard purge soft-deleted after grace (30d)
        if (q.toLowerCase().includes('delete from evidence') && q.toLowerCase().includes('deleted_at')) {
          const before = state.evidence.length;
          state.evidence = state.evidence.filter((row) => !(row.deleted_at && row.deleted_at.getTime() <= now.getTime() - 30 * dayMs));
          return { rows: [], rowCount: before - state.evidence.length };
        }
        // scan/count helpers
        if (q.toLowerCase().includes('select') && q.toLowerCase().includes('from evidence')) {
          return { rows: state.evidence };
        }
        if (q.toLowerCase().includes('select') && q.toLowerCase().includes('from facts')) {
          return { rows: state.facts };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as any;

    const runBackup = vi.fn(async () => { state.backupCalls += 1; });

    const first = await runRetentionSweeper({ pool, now, runBackup });
    expect(first.softDeleted).toBeGreaterThanOrEqual(1);
    expect(first.purged).toBeGreaterThanOrEqual(1);
    expect(first.durationMs).toBeGreaterThanOrEqual(0);
    expect(runBackup).toHaveBeenCalledTimes(1);

    // 91-day-old raw evidence soft-deleted, 89-day-old kept
    expect(state.evidence.find((r) => r.id === 'ev-old')?.deleted_at).not.toBeNull();
    expect(state.evidence.find((r) => r.id === 'ev-recent')?.deleted_at).toBeNull();
    // distilled facts exempt
    expect(state.facts.find((r) => r.id === 'fact-old')).toBeDefined();
    // soft-deleted 31d purged, 10d grace kept
    expect(state.evidence.find((r) => r.id === 'ev-soft-old')).toBeUndefined();
    expect(state.evidence.find((r) => r.id === 'ev-soft-recent')).toBeDefined();

    // second immediate run is a no-op (no further backup/purge/soft-delete)
    const beforeCount = state.evidence.length;
    const second = await runRetentionSweeper({ pool, now, runBackup });
    expect(second.softDeleted).toBe(0);
    expect(second.purged).toBe(0);
    expect(runBackup).toHaveBeenCalledTimes(1);
    expect(state.evidence.length).toBe(beforeCount);
  });
});
