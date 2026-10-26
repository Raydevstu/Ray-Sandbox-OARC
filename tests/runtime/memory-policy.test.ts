import { describe, expect, it } from 'vitest';
import { createMemoryPolicy, policyFingerprint, validateMemoryPolicy } from '../../lib/runtime/memory-policy';

const policy = createMemoryPolicy({
  policyId: 'default-memory',
  version: 3,
  scope: { bankId: 'bank-1', projectId: 'project-1', userId: 'user-1' },
  retentionDays: 365,
  minimumConfidence: 0.7,
  approvalRequiredFor: ['sensitive'],
  connectorAllowlist: ['codex'],
  model: { provider: 'local', model: 'deterministic', maxCostUsd: 0 },
  explainability: { required: true, includeSource: true, includeRationale: true },
});

describe('memory policy contract', () => {
  it('creates a complete versioned and auditable policy', () => {
    expect(policy).toMatchObject({
      policyId: 'default-memory', version: 3, retentionDays: 365,
      minimumConfidence: 0.7, approvalRequiredFor: ['sensitive'],
      scope: { bankId: 'bank-1', projectId: 'project-1', userId: 'user-1' },
      audit: { createdBy: 'system', changeReason: 'initial policy' },
    });
    expect(policy.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(policy.updatedAt).toBeTruthy();
  });

  it('rejects unsafe policy values and missing explainability', () => {
    expect(() => validateMemoryPolicy({ ...policy, minimumConfidence: 1.1 })).toThrow(/minimumConfidence/);
    expect(() => validateMemoryPolicy({ ...policy, retentionDays: 0 })).toThrow(/retentionDays/);
    expect(() => validateMemoryPolicy({ ...policy, explainability: { ...policy.explainability, required: false } })).toThrow(/explainability/);
  });

  it('has a stable fingerprint independent of object key order', () => {
    const reordered = { ...policy, scope: { userId: 'user-1', projectId: 'project-1', bankId: 'bank-1' } };
    expect(policyFingerprint(policy)).toBe(policy.fingerprint);
    expect(policyFingerprint(reordered)).toBe(policy.fingerprint);
  });

  it('requires an explicit audit reason for revisions', () => {
    expect(() => createMemoryPolicy({ ...policy, version: 4, audit: { createdBy: 'operator', changeReason: '' } })).toThrow(/changeReason/);
  });
});
