import type { WorkflowRun } from './contracts';

export type WorkflowClientState = 'healthy' | 'empty' | 'degraded' | 'unavailable' | 'unauthorized' | 'failed';
export type WorkflowClientResult<T> = Readonly<{ state: WorkflowClientState; data?: T; error?: string; requestId?: string; workflowRunId?: string; trace?: Record<string, unknown>; retryable?: boolean }>;

export async function persistWorkflowRun(run: WorkflowRun): Promise<WorkflowClientResult<WorkflowRun>> {
  try {
    const response = await fetch('/api/v1/memory/workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(run) });
    const body = await response.json() as { data?: WorkflowRun; error?: string; state?: WorkflowClientState; requestId?: string; workflowRunId?: string; retryable?: boolean };
    return { state: response.ok ? 'healthy' : body.state ?? (response.status === 503 ? 'unavailable' : response.status === 401 || response.status === 403 ? 'unauthorized' : 'failed'), data: body.data, error: body.error, requestId: body.requestId, workflowRunId: body.workflowRunId, retryable: body.retryable };
  } catch (error) { return { state: 'unavailable', error: error instanceof Error ? error.message : 'workflow API unavailable' }; }
}

async function call<T>(url: string, body: unknown): Promise<WorkflowClientResult<T>> {
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json() as { data?: T; error?: string; state?: WorkflowClientState; requestId?: string; workflowRunId?: string; trace?: Record<string, unknown>; retryable?: boolean };
    return { state: response.ok ? 'healthy' : payload.state ?? (response.status === 503 ? 'unavailable' : response.status === 401 || response.status === 403 ? 'unauthorized' : 'failed'), data: payload.data, error: payload.error, requestId: payload.requestId, workflowRunId: payload.workflowRunId, trace: payload.trace, retryable: payload.retryable };
  } catch (error) { return { state: 'unavailable', error: error instanceof Error ? error.message : 'canonical API unavailable' }; }
}

export const retainWorkflowSource = (input: Readonly<Record<string, unknown>>) => call<{ fact: unknown }>('/api/v1/memory/retain', input);
export const recallWorkflow = (input: Readonly<Record<string, unknown>>) => call<{ facts: readonly unknown[]; traceId: string; workflowRunId?: string }>('/api/v1/memory/recall', input);
export const correctWorkflow = (recordId: string, input: Readonly<Record<string, unknown>>) => call<{ revision: unknown; workflow?: WorkflowRun }>(`/api/v1/memory/${encodeURIComponent(recordId)}`, input);
export const evaluateWorkflow = (input: Readonly<Record<string, unknown>>) => call<{ run: unknown; metrics: unknown; workflow?: WorkflowRun }>('/api/v1/memory/evaluate', input);
export const replayWorkflow = (input: Readonly<Record<string, unknown>>) => call<{ comparison: unknown; workflowRun: unknown }>('/api/v1/memory/replay', input);
export async function loadWorkflowRun(scope: Readonly<{ tenantId: string; bankId: string; projectId: string; workflowRunId: string }>): Promise<WorkflowClientResult<WorkflowRun | null>> {
  try { const response = await fetch(`/api/v1/memory/workflow?${new URLSearchParams(scope)}`); const body = await response.json() as { data?: WorkflowRun | null; error?: string; state?: WorkflowClientState; requestId?: string; retryable?: boolean }; return { state: body.state ?? (response.ok ? 'healthy' : 'failed'), data: body.data, error: body.error, requestId: body.requestId, retryable: body.retryable }; } catch (error) { return { state: 'unavailable', error: error instanceof Error ? error.message : 'workflow API unavailable', retryable: true }; }
}
