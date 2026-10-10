import { describe, expect, it } from 'vitest';
import { createMemoryPolicy } from '../../lib/runtime/memory-policy';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const policy = createMemoryPolicy({ policyId: 'p', version: 1, scope: {}, retentionDays: 30, minimumConfidence: 0.5, approvalRequiredFor: [], connectorAllowlist: ['codex'], model: { provider: 'local', model: 'deterministic', maxCostUsd: 0 }, explainability: { required: true, includeSource: true, includeRationale: true } });

describe('memory policy persistence contract', () => {
  it('stores and returns policies in descending version order within scope', async () => {
    const repository = new TestRepository('tenant-1');
    const scope = { tenantId: 'tenant-1', bankId: 'bank-1' };
    await repository.saveMemoryPolicy({ ...scope, projectId: 'project-1', policy });
    await repository.saveMemoryPolicy({ ...scope, projectId: 'project-1', policy: createMemoryPolicy({ ...policy, version: 2, audit: { createdBy: 'operator', changeReason: 'raise threshold' } }) });
    const rows = await repository.listMemoryPolicies(scope, 'project-1', 10);
    expect(rows.map((row) => row.policy.version)).toEqual([2, 1]);
    await expect(repository.listMemoryPolicies({ tenantId: 'tenant-2', bankId: 'bank-1' }, 'project-1', 10)).rejects.toThrow('scope denied');
  });
});
