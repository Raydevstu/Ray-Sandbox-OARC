import { describe, expect, it } from 'vitest';
import { measureRecallResponse } from '../../lib/runtime/recall-response-metrics';

describe('recall response metrics', () => {
  it('reports bounded result counts and serialized envelope bytes', () => {
    expect(measureRecallResponse({ facts: [{ evidenceIds: ['e1', 'e2'] }, { evidenceIds: [] }] })).toEqual({ facts: 2, evidence: 2, bytes: 58 });
  });
});
