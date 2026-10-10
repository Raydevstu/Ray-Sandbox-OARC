export type ApiEnvelope<T> = Readonly<{ ok: boolean; requestId: string; data?: T; error?: string; retryable?: boolean }>;
export type MemoryApiTransport = Readonly<{ request(path: string, init: RequestInit): Promise<ApiEnvelope<unknown>> }>;
export type MemoryApiClient = Readonly<{
  retain(input: Record<string, unknown>): Promise<ApiEnvelope<unknown>>;
  recall(input: Record<string, unknown>): Promise<ApiEnvelope<unknown>>;
  trace(input: Record<string, unknown>): Promise<ApiEnvelope<unknown>>;
  correct(id: string, input: Record<string, unknown>): Promise<ApiEnvelope<unknown>>;
  replay(input: Record<string, unknown>): Promise<ApiEnvelope<unknown>>;
  evaluate(input: Record<string, unknown>): Promise<ApiEnvelope<unknown>>;
  get(id: string, scope: Record<string, string>): Promise<ApiEnvelope<unknown>>;
  feedback(input: Record<string, unknown>): Promise<ApiEnvelope<unknown>>;
}>;
const json = (method: string, body: Record<string, unknown>): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
export const createMemoryApiClient = (transport: MemoryApiTransport): MemoryApiClient => ({
  retain: (input) => transport.request('/api/v1/memory/retain', json('POST', input)),
  recall: (input) => transport.request('/api/v1/memory/recall', json('POST', input)),
  trace: (input) => transport.request('/api/v1/memory/trace', json('POST', input)),
  correct: (id, input) => transport.request(`/api/v1/memory/${encodeURIComponent(id)}`, json('PATCH', input)),
  replay: (input) => transport.request('/api/v1/memory/replay', json('POST', input)),
  evaluate: (input) => transport.request('/api/v1/memory/evaluate', json('POST', input)),
  get: (id, scope) => transport.request(`/api/v1/memory/${encodeURIComponent(id)}?${new URLSearchParams(scope)}`, { method: 'GET' }),
  feedback: (input) => transport.request(`/api/v1/memory/${encodeURIComponent(String(input.factId))}/feedback`, json('POST', input)),
});
