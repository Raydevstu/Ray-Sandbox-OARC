import type { PromptVersion, WorkflowEnvelope } from './contracts';

export type PromptScope = Readonly<{ tenantId: string; bankId: string; projectId: string }>;
export async function savePromptVersion(scope: PromptScope, input: Omit<PromptVersion, keyof PromptScope | 'createdAt'>, fetcher: typeof fetch = fetch): Promise<WorkflowEnvelope<PromptVersion>> {
  const response = await fetcher('/api/v1/prompts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...scope, ...input }) });
  return await response.json() as WorkflowEnvelope<PromptVersion>;
}
