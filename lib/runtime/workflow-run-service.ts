import type { CanonicalRepository } from './repositories/interfaces';
import type { MemoryScope, WorkflowRun } from './contracts';

export async function advanceWorkflowRun(repository: CanonicalRepository, scope: MemoryScope, input: Readonly<{ workflowRunId?: string; projectId: string; step: string; status?: WorkflowRun['status']; traceId?: string; eventId?: string }>) {
  if (!input.workflowRunId) return undefined;
  const now = new Date().toISOString();
  const current = await repository.getWorkflowRun(scope, input.workflowRunId);
  const completed = current?.completedSteps.includes(input.step) ? current.completedSteps : [...(current?.completedSteps ?? []), input.step];
  const run: WorkflowRun = { tenantId: scope.tenantId, bankId: scope.bankId, workflowRunId: input.workflowRunId, projectId: input.projectId, mode: current?.mode ?? 'real', currentStep: input.step, completedSteps: completed, status: input.status ?? current?.status ?? 'active', createdAt: current?.createdAt ?? now, updatedAt: now, ...(input.traceId ? { lastTraceId: input.traceId } : current?.lastTraceId ? { lastTraceId: current.lastTraceId } : {}), ...(input.eventId ? { lastEventId: input.eventId } : current?.lastEventId ? { lastEventId: current.lastEventId } : {}) };
  await repository.upsertWorkflowRun(run);
  return run;
}
