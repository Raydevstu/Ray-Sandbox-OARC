import { describe, expect, it } from 'vitest';
import { DenseProvider, type EmbeddingProvider } from '../../lib/runtime/providers/dense';
import { buildGraphProjection } from '../../lib/runtime/projections/graph';
import type { MemoryFactRevision } from '../../lib/runtime/contracts';

const fact = (id: string, claim: string): MemoryFactRevision => ({ tenantId: 't1', bankId: 'b1', id, revision: 1, claim, confidence: 0.9, evidenceIds: [`e-${id}`], createdAt: '2026-01-01T00:00:00.000Z' });

describe('dense retrieval and graph projection', () => {
  it('rejects a disabled embedding capability without falling back silently', async () => {
    const provider = new DenseProvider({ enabled: false, dimension: 3, embed: { dimension: 3, embed: async () => [1, 0, 0] } });
    await expect(provider.search({ tenantId: 't1', bankId: 'b1', query: 'memory', facts: [fact('f1', 'memory')], limit: 3 })).rejects.toThrow('dense retrieval is disabled');
  });

  it('ranks scoped facts by cosine similarity', async () => {
    const embed: EmbeddingProvider = { dimension: 2, embed: async (text) => text === 'near' ? [1, 0] : [0, 1] };
    const provider = new DenseProvider({ enabled: true, dimension: 2, embed });
    const results = await provider.search({ tenantId: 't1', bankId: 'b1', query: 'near', facts: [fact('f1', 'near'), fact('f2', 'far')], limit: 2 });
    expect(results.map((result) => result.fact.id)).toEqual(['f1']);
  });

  it('builds a bounded graph projection and refuses cross-scope facts', () => {
    const projection = buildGraphProjection({ tenantId: 't1', bankId: 'b1' }, [fact('f1', 'Ray uses PostgreSQL')], 10);
    expect(projection.nodes).toHaveLength(4);
    expect(projection.edges).toHaveLength(3);
    expect(() => buildGraphProjection({ tenantId: 't1', bankId: 'b1' }, [{ ...fact('f2', 'other'), tenantId: 't2' }], 10)).toThrow('scope mismatch');
  });
});
