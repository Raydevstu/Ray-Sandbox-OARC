import type { ProjectEvent } from '../contracts';
import type { ExtractionCandidate, MemoryExtractionProvider } from '../memory-extraction';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
type GeminiProviderOptions = Readonly<{ apiKey?: string; model?: string; fetchImpl?: FetchLike }>;

const redact = (text: string): string => text
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
  .replace(/\b(?:bearer|api[_-]?key|token)\s+[^\s]+/gi, '[REDACTED_SECRET]');

const textOf = (event: ProjectEvent): string => {
  const conversation = event.payload.conversation as { content?: unknown } | undefined;
  return redact(typeof conversation?.content === 'string' ? conversation.content : JSON.stringify(event.payload));
};

const responseText = (value: unknown): string => {
  const response = value as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  const text = response.candidates?.[0]?.content?.parts?.map((part) => typeof part.text === 'string' ? part.text : '').join('');
  if (!text) throw new Error('Gemini returned no proposal text');
  return text.replace(/^```json\s*|\s*```$/g, '').trim();
};

const bindSourceEvidence = (candidate: ExtractionCandidate, events: readonly ProjectEvent[]): ExtractionCandidate => {
  const event = events.find((item) => item.id === candidate.sourceEventId);
  if (!event) throw new Error('Gemini proposal references an unknown source event');
  const conversation = event.payload.conversation as { conversationId?: unknown; messageId?: unknown } | undefined;
  return {
    ...candidate,
    record: {
      ...candidate.record,
      tenantId: event.tenantId,
      bankId: event.bankId,
      projectId: event.projectId,
      source: {
        ...candidate.record.source,
        platform: 'gemini',
        conversationId: typeof conversation?.conversationId === 'string' ? conversation.conversationId : undefined,
        messageId: typeof conversation?.messageId === 'string' ? conversation.messageId : undefined,
        timestamp: event.occurredAt,
      },
      evidence: [{ kind: 'conversation', reference: event.id, observedAt: event.occurredAt }],
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
    },
  };
};

export const createGeminiExtractionProvider = (options: GeminiProviderOptions = {}): MemoryExtractionProvider => {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  const model = options.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: `gemini:${model}`,
    async extract(events) {
      const sourceEvents = events.map((event) => ({ id: event.id, tenantId: event.tenantId, bankId: event.bankId, projectId: event.projectId, occurredAt: event.occurredAt, type: event.type, text: textOf(event) }));
      const prompt = [
        'Extract memory proposals from the following redacted events.',
        'Return JSON only: {"candidates":[{"sourceEventId":string,"rule":string,"record":ProjectMemoryRecord}]}.',
        'Set sourceEventId to one supplied event id. The evidence reference MUST equal that same immutable sourceEventId; do not use message IDs. Proposals are not approved memory.',
        JSON.stringify(sourceEvents),
      ].join('\n');
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json' } }),
      });
      if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
      let parsed: unknown;
      try { parsed = JSON.parse(responseText(await response.json())); } catch { throw new Error('Gemini did not return valid JSON'); }
      const candidates = (parsed as { candidates?: unknown }).candidates;
      if (!Array.isArray(candidates)) throw new Error('Gemini response is missing candidates');
      return (candidates as ExtractionCandidate[]).map((candidate) => bindSourceEvidence(candidate, events));
    },
  };
};
