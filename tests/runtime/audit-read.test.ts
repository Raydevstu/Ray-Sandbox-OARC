import { describe, expect, it } from 'vitest';
import { readProjectMemoryAudit } from '../../lib/runtime/audit-read';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import type { ProjectMemoryRecord } from '../../lib/runtime/contracts';

const scope = { tenantId: 't1', bankId: 'b1' } as const;
const record: ProjectMemoryRecord = { ...scope, id: 'r1', projectId: 'p1', identity: { runId: 'run-2' }, type: 'decision', title: 'Decision', content: 'Use PostgreSQL', status: 'verified', confidence: 0.9, importance: 'high', source: { platform: 'codex', timestamp: '2026-10-08T00:00:00.000Z' }, evidence: [], supersedes: [], relatedRecords: [], createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z' };

describe('project-memory audit read', () => {
  it('reads repository records with scope and filter applied', async () => {
    const repository = new TestRepository('t1');
    await repository.appendProjectMemory(record);
    const result = await readProjectMemoryAudit(repository, { scope, projectId: 'p1', filter: { 'identity.runId': 'run-2' } });
    expect(result.total).toBe(1);
    expect(result.counts.verified).toBe(1);
  });
  it('does not return records from another project', async () => {
    const repository = new TestRepository('t1');
    await repository.appendProjectMemory(record);
    const result = await readProjectMemoryAudit(repository, { scope, projectId: 'other' });
    expect(result.total).toBe(0);
  });
  it('preserves an explicit capture-gap message for degraded audit reads', async () => {
    const repository = new TestRepository('t1');
    const result = await readProjectMemoryAudit(repository, { scope, projectId: 'p1', captureGaps: ['PostgreSQL temporarily unavailable'] });
    expect(result.captureGaps).toEqual(['PostgreSQL temporarily unavailable']);
  });
});
