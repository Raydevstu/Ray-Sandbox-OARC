import { describe, expect, it } from 'vitest';
import { EvidenceRecordSchema, MemoryFactRevisionSchema, MemoryScopeSchema, RetrievalRequestSchema } from '../../lib/runtime/schemas';

describe('runtime contracts', () => {
  it('rejects scopes without tenant and bank identifiers', () => {
    expect(() => MemoryScopeSchema.parse({ tenantId: 'tenant' })).toThrow();
    expect(() => MemoryScopeSchema.parse({ bankId: 'bank' })).toThrow();
  });

  it('requires scope on retrieval requests', () => {
    expect(() => RetrievalRequestSchema.parse({ query: 'remember this' })).toThrow();
  });

  it('creates stable ids from deterministic input', async () => {
    const { stableId } = await import('../../lib/runtime/contracts');
    expect(stableId('fact', 'tenant', 'bank', 'claim')).toBe(
      stableId('fact', 'tenant', 'bank', 'claim'),
    );
    expect(stableId('fact', 'tenant', 'bank', 'claim')).not.toBe(
      stableId('fact', 'other-tenant', 'bank', 'claim'),
    );
    expect(stableId('ab', 'c')).not.toBe(stableId('a', 'bc'));
  });

  it('requires at least one evidence id for every fact', () => {
    expect(() => MemoryFactRevisionSchema.parse({
      tenantId: 'tenant', bankId: 'bank', id: 'fact', revision: 1,
      claim: 'claim', confidence: 1, evidenceIds: [], createdAt: '2026-10-06T00:00:00.000Z',
    })).toThrow();
  });

  it('rejects unknown fields in runtime records', () => {
    const evidence = { tenantId: 'tenant', bankId: 'bank', id: 'evidence', source: 'source', content: 'content', provenance: 'origin', createdAt: '2026-10-06T00:00:00.000Z', extra: true };
    expect(() => EvidenceRecordSchema.parse(evidence)).toThrow();
    expect(() => RetrievalRequestSchema.parse({ tenantId: 'tenant', bankId: 'bank', query: 'q', extra: true })).toThrow();
  });
});
