import { describe, expect, it } from 'vitest';
import { routeProposalForApproval } from '../../lib/runtime/proposal-approval';
import { createMemoryPolicy } from '../../lib/runtime/memory-policy';

const policy = createMemoryPolicy({ policyId: 'proposal-policy', version: 1, scope: {}, retentionDays: 30, minimumConfidence: 0.8, approvalRequiredFor: [], connectorAllowlist: ['gemini'], model: { provider: 'local', model: 'test', maxCostUsd: 0 }, explainability: { required: true, includeSource: true, includeRationale: true } });
const candidate = (overrides: Record<string, unknown> = {}) => ({ sourceEventId: 'event-1', rule: 'test', record: { id: 'record-1', tenantId: 't1', bankId: 'b1', projectId: 'p1', type: 'requirement', title: 'Use provenance', content: 'Preserve source provenance.', status: 'pending', confidence: 0.9, importance: 'normal', source: { platform: 'gemini', timestamp: '2026-10-10T00:00:00.000Z' }, evidence: [{ kind: 'conversation', reference: 'event-1', observedAt: '2026-10-10T00:00:00.000Z' }], supersedes: [], relatedRecords: [], createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z', ...overrides } });

describe('provider proposal approval routing', () => {
  it.each([
    ['allow', candidate(), {}, 'allow'],
    ['deny', { record: {} }, {}, 'deny'],
    ['redact', candidate({ content: 'api_key=do-not-persist' }), {}, 'redact'],
    ['require_review', candidate({ confidence: 0.2 }), {}, 'require_review'],
    ['defer', candidate(), { timedOut: true }, 'defer'],
  ] as const)('routes %s deterministically', (_name, proposal, input, disposition) => {
    expect(routeProposalForApproval(proposal, policy, input).disposition).toBe(disposition);
  });
});
