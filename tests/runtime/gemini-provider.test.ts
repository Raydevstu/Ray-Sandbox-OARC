import { describe, expect, it, vi } from 'vitest';
import { createGeminiExtractionProvider } from '../../lib/runtime/providers/gemini';
import { normalizeCodexMcpEvent } from '../../lib/runtime/codex-ingestion';

const event = normalizeCodexMcpEvent(
  { tenantId: 't1', bankId: 'b1' },
  { projectId: 'p1', conversationId: 'c1', timestamp: '2026-10-10T00:00:00.000Z' },
  { messageId: 'm1', method: 'chat', content: 'Decision: email alice@example.com and use PostgreSQL.' },
);

describe('Gemini extraction provider', () => {
  it('sends redacted evidence and parses schema-shaped proposals', async () => {
    const response = { candidates: [{ content: { parts: [{ text: JSON.stringify({ candidates: [{ sourceEventId: event.id, rule: 'provider-decision', record: { id: 'candidate-provider-m1', tenantId: 't1', bankId: 'b1', projectId: 'p1', type: 'decision', title: 'Decision: use PostgreSQL', content: 'Use PostgreSQL.', status: 'pending', confidence: 0.9, importance: 'high', source: { platform: 'gemini', conversationId: 'c1', messageId: 'm1', timestamp: event.occurredAt }, evidence: [{ kind: 'conversation', reference: 'm1', observedAt: event.occurredAt }], supersedes: [], relatedRecords: [], createdAt: event.occurredAt, updatedAt: event.occurredAt } }] }) }] } }] };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    const provider = createGeminiExtractionProvider({ apiKey: 'test-key', fetchImpl, model: 'gemini-test' });

    const candidates = await provider.extract([event]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].record.content).toBe('Use PostgreSQL.');
    expect(candidates[0]).toMatchObject({ sourceEventId: event.id, record: { tenantId: event.tenantId, bankId: event.bankId, projectId: event.projectId, source: { platform: 'gemini', conversationId: 'c1', messageId: 'm1', timestamp: event.occurredAt }, evidence: [{ reference: event.id, observedAt: event.occurredAt }] } });
    const body = JSON.stringify(JSON.parse(String(fetchImpl.mock.calls[0][1].body)));
    expect(body).not.toContain('alice@example.com');
    expect(body).toContain('[REDACTED_EMAIL]');
    expect(fetchImpl.mock.calls[0][0]).toContain('gemini-test:generateContent');
  });

  it('fails closed when Gemini returns malformed JSON', async () => {
    const provider = createGeminiExtractionProvider({ apiKey: 'test-key', fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), { status: 200 })) });
    await expect(provider.extract([event])).rejects.toThrow('valid JSON');
  });
});
