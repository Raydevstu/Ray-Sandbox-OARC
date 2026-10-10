import { describe, expect, it } from 'vitest';
import { buildRetrievalTrace } from '../../lib/runtime/retrieval-trace';
import type { ProjectMemoryRecord } from '../../lib/runtime/contracts';

const record = (overrides: Partial<ProjectMemoryRecord> = {}): ProjectMemoryRecord => ({
  tenantId: 't1', bankId: 'b1', id: 'r1', projectId: 'p1', type: 'requirement', title: 'PostgreSQL persistence',
  content: 'PostgreSQL is the canonical project persistence store.', status: 'verified', confidence: 0.95, importance: 'high',
  source: { platform: 'codex', conversationId: 'c1', messageId: 'm1', timestamp: '2026-10-10T00:00:00.000Z' },
  evidence: [{ kind: 'conversation', reference: 'm1', observedAt: '2026-10-10T00:00:00.000Z' }], supersedes: [], relatedRecords: [],
  createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z', ...overrides,
});

describe('retrieval trace', () => {
  it('returns an evidence-backed explanation with deterministic ranking', () => {
    const result = buildRetrievalTrace([record(), record({ id: 'r2', content: 'Use PostgreSQL for durable storage.', evidence: [{ kind: 'test', reference: 'test-1', observedAt: '2026-10-10T00:00:01.000Z' }] })], 'canonical PostgreSQL persistence', 'trace-1');
    expect(result.traceId).toBe('trace-1');
    expect(result.items[0]).toMatchObject({ recordId: 'r1', evidenceReferences: ['m1'], source: { platform: 'codex' }, status: 'verified', updatedAt: '2026-10-10T00:00:00.000Z' });
    expect(result.items[0].rationale).toContain('query terms');
  });

  it('excludes records without evidence and reports the gap', () => {
    const result = buildRetrievalTrace([record({ evidence: [] })], 'PostgreSQL', 'trace-2');
    expect(result.items).toHaveLength(0);
    expect(result.gaps).toContain('record r1 has no source evidence');
  });
});
