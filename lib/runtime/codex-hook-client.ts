import type { CodexMcpCall, CodexToolResult } from './codex-ingestion';
import type { ControlledBenchmarkRun } from './benchmark-contract';

export type CodexHookClientConfig = Readonly<{ endpoint: string; tenantId: string; bankId: string; projectId: string; conversationId: string; authorization?: string; fetcher?: typeof fetch; maxAttempts?: number; retryDelayMs?: number; redact?: (value: unknown) => unknown }>;
export type CodexHookResponse = Readonly<{ eventId: string; duplicate: boolean; queued: boolean }>;

const defaultRedact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(defaultRedact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [/token|secret|password|authorization|api[-_]?key/i.test(key) ? [key, '[REDACTED_SECRET]'] : [key, defaultRedact(entry)] ]));
};
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const post = async (config: CodexHookClientConfig, payload: Record<string, unknown>): Promise<CodexHookResponse> => {
  const attempts = Math.max(1, Math.min(5, config.maxAttempts ?? 3));
  const bodyPayload = (config.redact ?? defaultRedact)({ tenantId: config.tenantId, bankId: config.bankId, projectId: config.projectId, conversationId: config.conversationId, ...payload });
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await (config.fetcher ?? fetch)(config.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(config.authorization ? { authorization: config.authorization } : {}) }, body: JSON.stringify(bodyPayload) });
      const body = await response.json() as { ok?: boolean; data?: CodexHookResponse; error?: string };
      if (response.ok && body.ok && body.data) return body.data;
      const retryable = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === attempts) throw new Error(body.error ?? `Codex hook failed with status ${response.status}`);
    } catch (error) {
      if (error instanceof Error && (/^Codex hook failed with status/.test(error.message) || error.message === 'scope denied')) throw error;
      if (attempt === attempts) throw error;
    }
    await wait((config.retryDelayMs ?? 100) * (2 ** (attempt - 1)));
  }
  throw new Error('Codex hook retry budget exhausted');
};

export const sendCodexMcpCall = (config: CodexHookClientConfig, call: CodexMcpCall): Promise<CodexHookResponse> => post(config, { messageId: call.messageId, timestamp: call.timestamp ?? new Date().toISOString(), kind: 'mcp-call', method: call.method, name: call.name, role: call.role, content: call.content, arguments: call.arguments });
export const sendCodexToolResult = (config: CodexHookClientConfig, result: CodexToolResult): Promise<CodexHookResponse> => post(config, { messageId: result.messageId, timestamp: result.timestamp ?? new Date().toISOString(), kind: 'tool-result', name: result.name, result: result.result });

export type CodexBenchmarkResponse = Readonly<{ run: ControlledBenchmarkRun; summary: Record<string, unknown> }>;

export const submitCodexBenchmarkRun = async (config: CodexHookClientConfig, benchmarkEndpoint: string, run: ControlledBenchmarkRun): Promise<CodexBenchmarkResponse> => {
  const response = await (config.fetcher ?? fetch)(benchmarkEndpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(config.authorization ? { authorization: config.authorization } : {}) }, body: JSON.stringify({ tenantId: config.tenantId, bankId: config.bankId, projectId: config.projectId, run }) });
  const body = await response.json() as { ok?: boolean; data?: CodexBenchmarkResponse; error?: string };
  if (!response.ok || !body.ok || !body.data) throw new Error(body.error ?? `Codex benchmark submission failed with status ${response.status}`);
  return body.data;
};
