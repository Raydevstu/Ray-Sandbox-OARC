import type { WorkflowEnvelope } from './contracts';

type Scope = Readonly<{ tenantId: string; bankId: string; projectId: string; workflowRunId?: string }>;
export async function postPhase3Step(step: 'context' | 'evaluate' | 'learn' | 'orchestrate', scope: Scope, payload: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<WorkflowEnvelope<Record<string, unknown>>> {
  const response = await fetcher('/api/v1/workflow/step', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ step, ...scope, payload }) });
  return await response.json() as WorkflowEnvelope<Record<string, unknown>>;
}
