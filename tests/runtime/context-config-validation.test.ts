import { describe, expect, it } from 'vitest';
import { parseContextConfigInput } from '../../lib/runtime/context-config';

describe('ContextConfig validation', () => {
  it('accepts the recall settings contract and rejects malformed settings', () => {
    expect(() => parseContextConfigInput({ configId: 'context-default', version: 1, settings: { budget: 'mid', budgetMode: 'fixed', maxTokens: 4096, rerankerCap: 300, rerankEnabled: true } })).not.toThrow();
    expect(() => parseContextConfigInput({ configId: 'context-default', version: 1, settings: { budget: 'wrong' } })).toThrow('invalid context settings');
  });
});
