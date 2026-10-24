export const developerWorkflowSteps = ['sample-project', 'ingest', 'retain', 'recall', 'trace', 'correct', 'replay', 'evaluate'] as const;
export type DeveloperWorkflowStep = typeof developerWorkflowSteps[number];
export type DeveloperWorkflowState = Readonly<{ workflowRunId: string; projectId: string; mode: 'sample' | 'real'; completed: readonly DeveloperWorkflowStep[] }>;
export const hydrateDeveloperWorkflow = (state: DeveloperWorkflowState, run: Readonly<{ workflowRunId: string; projectId: string; mode: 'sample' | 'real'; completedSteps: readonly string[] }>): DeveloperWorkflowState => ({
  ...state,
  workflowRunId: run.workflowRunId,
  projectId: run.projectId,
  mode: run.mode,
  completed: developerWorkflowSteps.filter((step) => run.completedSteps.includes(step)),
});
export const createDeveloperWorkflow = (projectId = 'ray-sample-project', workflowRunId = `workflow-${Date.now().toString(36)}`): DeveloperWorkflowState => ({ workflowRunId, projectId, mode: 'sample', completed: ['sample-project'] });
export const completeDeveloperStep = (state: DeveloperWorkflowState, step: DeveloperWorkflowStep): DeveloperWorkflowState => ({ ...state, completed: state.completed.includes(step) ? state.completed : [...state.completed, step] });
export const switchDeveloperProject = (state: DeveloperWorkflowState, projectId: string): DeveloperWorkflowState => ({ ...state, projectId, mode: 'real' });
