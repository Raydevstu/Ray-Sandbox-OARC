import { describe, expect, it } from 'vitest';
import { governCandidates, governProviderCandidates, invalidateByEvidence, routeExtractionCandidates } from '../../lib/runtime/memory-governance';
import { createMemoryPolicy } from '../../lib/runtime/memory-policy';
import type { ProjectMemoryRecord } from '../../lib/runtime/contracts';

const base = (id: string, content: string, overrides: Partial<ProjectMemoryRecord> = {}): ProjectMemoryRecord => ({ tenantId: 't1', bankId: 'b1', id, projectId: 'p1', type: 'decision', title: 'Database choice', content, status: 'active', confidence: 0.8, importance: 'high', source: { platform: 'codex', timestamp: '2026-10-07T00:00:00.000Z' }, evidence: [{ kind: 'conversation', reference: id, observedAt: '2026-10-07T00:00:00.000Z' }], supersedes: [], relatedRecords: [], createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z', ...overrides });
const candidate = (record: ProjectMemoryRecord) => ({ record, sourceEventId: `event-${record.id}`, rule: 'test' });
describe('project memory governance', () => {
  it('deduplicates equivalent content while retaining new evidence', () => { const result = governCandidates([base('r1', 'Use PostgreSQL')], [candidate(base('r2', ' use  PostgreSQL ', { evidence: [{ kind: 'test', reference: 'npm test', observedAt: '2026-10-07T00:00:01.000Z' }] }))]); expect(result.records).toHaveLength(1); expect(result.records[0].evidence).toHaveLength(2); expect(result.actions[0].kind).toBe('deduplicated'); });
  it('marks explicit predecessors superseded without deleting history', () => { const result = governCandidates([base('r1', 'Use PostgreSQL')], [candidate(base('r2', 'Use PostgreSQL 17', { supersedes: ['r1'] }))]); expect(result.records).toHaveLength(2); expect(result.records[0].status).toBe('superseded'); expect(result.records[1].supersedes).toEqual(['r1']); });
  it('marks contradictory records as conflict', () => { const result = governCandidates([base('r1', 'Use PostgreSQL')], [candidate(base('r2', 'Use SQLite'))]); expect(result.records.every((record) => record.status === 'conflict')).toBe(true); expect(result.actions[0].kind).toBe('conflict'); });
  it('invalidates records when their evidence becomes stale', () => { const result = invalidateByEvidence([base('r1', 'Use PostgreSQL')], [{ reference: 'r1', reason: 'source conversation was superseded', observedAt: '2026-10-07T00:00:02.000Z' }]); expect(result.records[0].status).toBe('stale'); expect(result.actions[0].kind).toBe('invalidated'); });
  it('requires provenance before canonicalization', () => { expect(() => governCandidates([], [candidate(base('r1', 'No source', { source: { platform: '', timestamp: '2026-10-07T00:00:00.000Z' } }))])).toThrow('provenance'); });
  it('routes low-confidence and policy-sensitive proposals to review without canonicalizing them', () => {
    const policy = createMemoryPolicy({ policyId: 'p', version: 1, scope: {}, retentionDays: 30, minimumConfidence: 0.8, approvalRequiredFor: ['decision'], connectorAllowlist: ['codex'], model: { provider: 'local', model: 'deterministic', maxCostUsd: 0 }, explainability: { required: true, includeSource: true, includeRationale: true } });
    const routed = routeExtractionCandidates([candidate(base('r1', 'Use PostgreSQL', { confidence: 0.7 }))], policy);
    expect(routed.review).toHaveLength(1);
    expect(routed.approved).toHaveLength(0);
    expect(routed.rejected).toHaveLength(0);
    expect(governCandidates([], routed.review).records).toHaveLength(1);
  });
  it('only canonicalizes provider proposals after policy approval', () => {
    const policy = createMemoryPolicy({ policyId: 'p2', version: 1, scope: {}, retentionDays: 30, minimumConfidence: 0.8, approvalRequiredFor: ['decision'], connectorAllowlist: ['codex'], model: { provider: 'local', model: 'deterministic', maxCostUsd: 0 }, explainability: { required: true, includeSource: true, includeRationale: true } });
    const result = governProviderCandidates([], [candidate(base('r1', 'Use PostgreSQL', { confidence: 0.95 }))], policy);
    expect(result.routing.review).toHaveLength(1);
    expect(result.records).toHaveLength(0);
  });
});
