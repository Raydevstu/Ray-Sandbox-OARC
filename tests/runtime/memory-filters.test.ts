import { describe, expect, it } from 'vitest';
import { filterProjectMemory } from '../../lib/runtime/memory-filters';
import type { ProjectMemoryRecord } from '../../lib/runtime/contracts';

const record = (id: string, status: ProjectMemoryRecord['status'], runId?: string): ProjectMemoryRecord => ({ tenantId: 't1', bankId: 'b1', id, projectId: 'p1', identity: { userId: 'alice', agentId: 'atlas', appId: 'oarc', runId }, type: 'decision', title: 'Database', content: id === 'new' ? 'Use PostgreSQL' : 'Use SQLite', status, confidence: id === 'new' ? 0.95 : 0.6, importance: 'high', source: { platform: 'codex', conversationId: 'c1', timestamp: '2026-10-08T00:00:00.000Z' }, evidence: [], supersedes: [], relatedRecords: [], createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z' });

describe('project-memory filter DSL', () => {
  const records = [record('old', 'superseded', 'run-1'), record('new', 'active', 'run-2')];
  it('supports nested scope and status filters', () => expect(filterProjectMemory(records, { AND: [{ 'identity.runId': 'run-2' }, { status: 'active' }] })).toHaveLength(1));
  it('supports OR, NOT, ranges, and wildcard existence', () => expect(filterProjectMemory(records, { OR: [{ confidence: { gte: 0.9 } }, { NOT: { 'identity.runId': 'missing' } }] })).toHaveLength(2));
  it('fails closed for unknown fields and operators', () => { expect(() => filterProjectMemory(records, { secret: 'x' })).toThrow('unsupported filter field'); expect(() => filterProjectMemory(records, { status: { regex: 'active' } })).toThrow('unsupported filter operator'); });
});
