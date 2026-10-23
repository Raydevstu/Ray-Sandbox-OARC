import { describe, expect, it } from 'vitest';
import { buildSloEventPlan } from '../../lib/runtime/slo-workload-plan';

describe('PostgreSQL SLO workload plan', () => {
  it('creates deterministic unique events plus duplicate retry attempts', () => {
    const plan = buildSloEventPlan({ runId: 'slo-test', uniqueEvents: 20, duplicateEvery: 5 });

    expect(plan).toHaveLength(24);
    expect(plan.filter((item) => item.attempt === 1)).toHaveLength(20);
    expect(plan.filter((item) => item.attempt > 1)).toHaveLength(4);
    expect(new Set(plan.map((item) => item.messageId)).size).toBe(20);
    expect(plan.filter((item) => item.attempt > 1).every((item) => item.duplicateOf === item.messageId)).toBe(true);
  });

  it('rejects invalid workload sizes instead of silently under-testing', () => {
    expect(() => buildSloEventPlan({ runId: 'slo-test', uniqueEvents: 0, duplicateEvery: 5 })).toThrow('uniqueEvents');
    expect(() => buildSloEventPlan({ runId: 'slo-test', uniqueEvents: 20, duplicateEvery: 0 })).toThrow('duplicateEvery');
  });
});
