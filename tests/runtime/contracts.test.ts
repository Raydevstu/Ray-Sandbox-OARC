import { describe, expect, it } from 'vitest';
import { MemoryScopeSchema, RetrievalRequestSchema } from '../../lib/runtime/schemas';

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
  });
});
