import { describe, expect, it } from 'vitest';
import { detectGraphConflicts, resolveGraphEntity, traverseTypedGraph, type GraphEdge, type GraphEntity } from '../../lib/runtime/typed-graph';
import { retrieveTypedGraph } from '../../lib/runtime/typed-graph-service';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const entities: GraphEntity[] = [
  { id: 'alice', label: 'Alice', type: 'person' },
  { id: 'ray', label: 'Ray', type: 'project' },
  { id: 'postgres', label: 'PostgreSQL', type: 'technology' },
];
const edges: GraphEdge[] = [
  { id: 'e1', from: 'alice', to: 'ray', type: 'works_on', validFrom: '2026-01-01T00:00:00.000Z', validTo: null, evidenceIds: ['ev-1'] },
  { id: 'e2', from: 'ray', to: 'postgres', type: 'uses', validFrom: '2026-02-01T00:00:00.000Z', validTo: null, evidenceIds: ['ev-2'] },
  { id: 'e3', from: 'ray', to: 'postgres', type: 'uses', validFrom: '2025-01-01T00:00:00.000Z', validTo: '2026-01-31T23:59:59.000Z', evidenceIds: ['ev-old'] },
];

describe('typed temporal graph', () => {
  it('traverses typed relationships with evidence and temporal validity', () => {
    const result = traverseTypedGraph(entities, edges, 'alice', { at: '2026-03-01T00:00:00.000Z', maxHops: 2 });
    expect(result.map((item) => item.entity.id)).toEqual(['ray', 'postgres']);
    expect(result[1].path.map((edge) => edge.type)).toEqual(['works_on', 'uses']);
    expect(result[1].path.every((edge) => edge.evidenceIds.length > 0)).toBe(true);
  });

  it('excludes expired edges and prevents cycles', () => {
    const result = traverseTypedGraph(entities, edges, 'alice', { at: '2026-01-15T00:00:00.000Z', maxHops: 3 });
    expect(result.map((item) => item.entity.id)).toEqual(['ray', 'postgres']);
    expect(result[1].path.at(-1)?.id).toBe('e3');
  });

  it('resolves aliases deterministically and reports ambiguity instead of guessing', () => {
    const aliased: GraphEntity[] = [
      { id: 'postgres', label: 'PostgreSQL', type: 'technology', aliases: ['postgres', 'pg'] },
      { id: 'project', label: 'Project', type: 'project', aliases: ['pg'] },
    ];
    expect(resolveGraphEntity(aliased, 'Postgres')).toMatchObject({ entityId: 'postgres', status: 'resolved' });
    expect(resolveGraphEntity(aliased, 'pg')).toMatchObject({ status: 'ambiguous', entityId: null, candidateIds: ['postgres', 'project'] });
  });

  it('marks contradictory active facts as reviewable and keeps superseded history', () => {
    const conflicts = detectGraphConflicts([
      { ...edges[1], id: 'current-a', evidenceIds: ['ev-a'] },
      { ...edges[1], id: 'current-b', evidenceIds: ['ev-b'], type: 'uses_other' },
      { ...edges[1], id: 'old', evidenceIds: ['ev-old'], validTo: '2026-02-01T00:00:00.000Z' },
    ]);
    expect(conflicts.find((conflict) => conflict.edgeIds.includes('current-a'))?.state).toBe('review');
    expect(conflicts.find((conflict) => conflict.edgeIds.includes('old'))).toBeUndefined();
  });

  it('returns a complete two-hop explanation for an as-of query', async () => {
    const repository = new TestRepository('tenant-1');
    const scope = { tenantId: 'tenant-1', bankId: 'bank-1' };
    await repository.saveGraphEntity(scope, { id: 'alice', label: 'Alice', type: 'person', aliases: ['operator'] });
    await repository.saveGraphEntity(scope, { id: 'upgrade', label: 'Upgrade', type: 'project' });
    await repository.saveGraphEntity(scope, { id: 'postgres', label: 'PostgreSQL', type: 'technology' });
    await repository.saveGraphEdge(scope, { id: 'old-link', from: 'alice', to: 'upgrade', type: 'worked_on', validFrom: '2025-01-01T00:00:00.000Z', validTo: '2025-12-31T23:59:59.000Z', evidenceIds: ['ev-1'] });
    await repository.saveGraphEdge(scope, { id: 'old-tech', from: 'upgrade', to: 'postgres', type: 'used', validFrom: '2025-01-01T00:00:00.000Z', validTo: '2025-12-31T23:59:59.000Z', evidenceIds: ['ev-2'] });
    const result = await retrieveTypedGraph(repository, scope, 'operator', { at: '2025-06-01T00:00:00.000Z', maxHops: 2 });
    expect(result.resolution.status).toBe('resolved');
    expect(result.results.at(-1)?.entity.id).toBe('postgres');
    expect(result.explanation.paths[0].map((hop) => hop.edgeId)).toEqual(['old-link', 'old-tech']);
    expect(result.explanation.paths[0].every((hop) => hop.evidenceIds.length > 0)).toBe(true);
  });
});
