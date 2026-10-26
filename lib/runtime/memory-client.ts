import type { MemoryFactRevision, WorkflowEnvelope } from './contracts';

export type RuntimeMemoryScope = Readonly<{ tenantId: string; bankId: string; projectId: string }>;
export type RuntimeMemoryClient = Readonly<{
  retain(input: RuntimeMemoryScope & Readonly<{ content: string; idempotencyKey: string; workflowRunId?: string }>): Promise<WorkflowEnvelope<{ fact: MemoryFactRevision; replayed: boolean }> | null>;
  recall(input: RuntimeMemoryScope & Readonly<{ query: string; workflowRunId?: string }>): Promise<WorkflowEnvelope<{ facts: readonly MemoryFactRevision[]; traceId: string }> | null>;
  correct(id: string, input: RuntimeMemoryScope & Readonly<{ claim: string; workflowRunId?: string }>): Promise<WorkflowEnvelope<{ corrected: boolean }> | null>;
}>;

type Fetcher = typeof fetch;

const request = async <T>(fetcher: Fetcher, url: string, init: RequestInit): Promise<WorkflowEnvelope<T> | null> => {
  const response = await fetcher(url, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => null) as WorkflowEnvelope<T> | null;
  return body ?? { ok: false, requestId: '', state: 'failed', error: `Request failed (${response.status})`, retryable: response.status >= 500 };
};

export const createRuntimeMemoryClient = (fetcher: Fetcher = fetch): RuntimeMemoryClient => ({
  retain: (input) => request(fetcher, '/api/v1/memory/retain', { method: 'POST', body: JSON.stringify({ ...input, source: 'memory-ui', provenance: 'ray-sandbox-oarc' }) }),
  recall: (input) => request(fetcher, '/api/v1/memory/recall', { method: 'POST', body: JSON.stringify(input) }),
  correct: (id, input) => request(fetcher, `/api/v1/memory/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
});
