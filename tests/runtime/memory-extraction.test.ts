import { describe, expect, it } from 'vitest';
import { extractProjectMemoryCandidates, extractWithProvider } from '../../lib/runtime/memory-extraction';
import { normalizeRuntimeHealthEvidence, normalizeTestEvidence } from '../../lib/runtime/evidence-ingestion';
import { normalizeCodexMcpEvent } from '../../lib/runtime/codex-ingestion';

const scope = { tenantId: 't1', bankId: 'b1' } as const;
const metadata = { projectId: 'p1', conversationId: 'c1', timestamp: '2026-10-07T00:00:00.000Z' } as const;
describe('deterministic project-memory extraction', () => {
  it('classifies explicit conversation content with provenance', () => {
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm1', method: 'chat', content: 'Decision: we will use PostgreSQL. This must preserve evidence.' });
    const candidates = extractProjectMemoryCandidates([event]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].record.type).toBe('decision');
    expect(candidates[0].record.source).toMatchObject({ platform: 'codex', conversationId: 'c1', messageId: 'm1' });
    expect(candidates[0].record.evidence[0]).toMatchObject({ kind: 'conversation', reference: 'm1' });
  });
  it('classifies operational evidence without treating raw events as records', () => {
    const test = normalizeTestEvidence(scope, { projectId: 'p1', source: 'ci', observedAt: metadata.timestamp }, { command: 'npm test', status: 'passed' });
    const health = normalizeRuntimeHealthEvidence(scope, { projectId: 'p1', source: 'runtime', observedAt: metadata.timestamp }, { endpoint: 'http://localhost:3020/health', status: 200, healthy: true });
    const candidates = extractProjectMemoryCandidates([test, health]);
    expect(candidates.map((candidate) => candidate.record.type)).toEqual(['test', 'runtime']);
    expect(candidates[0].record.status).toBe('verified');
    expect(candidates[1].record.evidence[0].reference).toBe('http://localhost:3020/health');
  });
  it('leaves ambiguous content unclassified and preserves deterministic IDs', () => {
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm2', method: 'chat', content: 'A neutral observation.' });
    expect(extractProjectMemoryCandidates([event])).toEqual([]);
    const decision = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm3', method: 'chat', content: 'We will keep the current contract.' });
    expect(extractProjectMemoryCandidates([decision])[0].record.id).toBe(extractProjectMemoryCandidates([decision])[0].record.id);
  });
});

describe('provider extraction boundary', () => {
  it('uses a provider and labels its provenance', async () => {
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm4', method: 'chat', content: 'We will use PostgreSQL.' });
    const result = await extractWithProvider([event], { name: 'test-provider', extract: async (events) => extractProjectMemoryCandidates(events) });
    expect(result.mode).toBe('provider');
    expect(result.provider).toBe('test-provider');
    expect(result.candidates).toHaveLength(1);
    expect(result.rejected).toBe(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
  it('falls back explicitly when the provider fails', async () => {
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm5', method: 'chat', content: 'We will use PostgreSQL.' });
    const result = await extractWithProvider([event], { name: 'failing-provider', extract: async () => { throw new Error('provider unavailable'); } });
    expect(result.mode).toBe('deterministic-degraded');
    expect(result.error).toBe('provider unavailable');
    expect(result.candidates).toHaveLength(1);
  });
  it('rejects provider candidates that fail the memory contract', async () => {
    const result = await extractWithProvider([], { name: 'invalid-provider', extract: async () => [{ record: { id: 'invalid' } as never, sourceEventId: 'e', rule: 'bad' }] });
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });
  it('enforces candidate and cost budgets while returning redacted telemetry', async () => {
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm6', method: 'chat', content: 'We will use PostgreSQL.' });
    const result = await extractWithProvider([event], { name: 'budgeted-provider', extract: async () => [
      ...extractProjectMemoryCandidates([event]),
      ...extractProjectMemoryCandidates([event]),
    ] }, { maxCandidates: 1, estimatedCostUsd: 0.2, maxCostUsd: 0.1 });
    expect(result.mode).toBe('deterministic-degraded');
    expect(result.error).toBe('provider cost budget exceeded');
    expect(result.telemetry).toMatchObject({ provider: 'budgeted-provider', accepted: 1, rejected: 1, costUsd: 0.2 });
    expect(JSON.stringify(result.telemetry)).not.toContain('PostgreSQL');
  });
  it('times out a provider and uses the deterministic fallback', async () => {
    const event = normalizeCodexMcpEvent(scope, metadata, { messageId: 'm7', method: 'chat', content: 'We will use PostgreSQL.' });
    const result = await extractWithProvider([event], { name: 'slow-provider', extract: async () => new Promise<never>(() => undefined) }, { timeoutMs: 5 });
    expect(result.mode).toBe('deterministic-degraded');
    expect(result.error).toBe('provider extraction timed out');
    expect(result.candidates).toHaveLength(1);
  });
});
