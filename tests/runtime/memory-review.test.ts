import { describe, expect, it } from 'vitest';
import { reviewProjectMemory } from '../../lib/runtime/memory-review';
import type { ProjectMemoryRecord } from '../../lib/runtime/contracts';

const base: ProjectMemoryRecord = { tenantId: 't1', bankId: 'b1', id: 'r1', projectId: 'p1', type: 'decision', title: 'Database', content: 'Use PostgreSQL', status: 'conflict', confidence: 0.8, importance: 'high', source: { platform: 'codex', timestamp: '2026-10-08T00:00:00.000Z' }, evidence: [], supersedes: [], relatedRecords: [], createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z' };
const request = (action: 'approve-supersession' | 'mark-uncertain' | 'invalidate') => ({ action, recordId: 'r1', reviewer: 'operator', reason: 'Reviewed against source evidence.', at: '2026-10-08T01:00:00.000Z' } as const);

describe('memory review governance', () => {
  it('records approval without deleting evidence history', () => { const result = reviewProjectMemory([base], request('approve-supersession')); expect(result.record.status).toBe('verified'); expect(result.record.evidence).toHaveLength(1); expect(result.event.type).toBe('ProjectMemoryReviewCompleted'); });
  it('makes uncertainty and invalidation explicit', () => { expect(reviewProjectMemory([base], request('mark-uncertain')).record.status).toBe('uncertain'); expect(reviewProjectMemory([base], request('invalidate')).record.status).toBe('stale'); });
  it('rejects missing records and incomplete review reasons', () => { expect(() => reviewProjectMemory([], request('invalidate'))).toThrow('not found'); expect(() => reviewProjectMemory([base], { ...request('invalidate'), reason: '' })).toThrow('review requires'); });
});
