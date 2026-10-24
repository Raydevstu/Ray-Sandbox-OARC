import { describe, expect, it } from 'vitest';
import { completeDeveloperStep, createDeveloperWorkflow, hydrateDeveloperWorkflow, switchDeveloperProject } from '../../lib/runtime/developer-workflow';

describe('developer workflow contract', () => {
  it('keeps one run id while progressing through the golden path', () => {
    const initial = createDeveloperWorkflow('sample');
    const progressed = completeDeveloperStep(completeDeveloperStep(initial, 'ingest'), 'retain');
    expect(progressed.workflowRunId).toBe(initial.workflowRunId);
    expect(progressed.completed).toEqual(['sample-project', 'ingest', 'retain']);
  });
  it('makes switching to a real project explicit', () => {
    const switched = switchDeveloperProject(createDeveloperWorkflow(), 'production-project');
    expect(switched).toMatchObject({ projectId: 'production-project', mode: 'real' });
  });
  it('hydrates durable progress without accepting unknown steps', () => {
    const hydrated = hydrateDeveloperWorkflow(createDeveloperWorkflow(), {
      workflowRunId: 'workflow-server',
      projectId: 'server-project',
      mode: 'real',
      completedSteps: ['sample-project', 'retain', 'unknown-step'],
    });
    expect(hydrated).toEqual({
      workflowRunId: 'workflow-server',
      projectId: 'server-project',
      mode: 'real',
      completed: ['sample-project', 'retain'],
    });
  });
});
