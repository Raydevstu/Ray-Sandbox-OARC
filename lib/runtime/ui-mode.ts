export type UiRuntimeMode = 'deterministic' | 'runtime';

export type RuntimeHealth = Readonly<{
  status: 'healthy' | 'unavailable' | 'unknown';
  requestId?: string;
  message: string;
}>;

export const DEFAULT_UI_RUNTIME_MODE: UiRuntimeMode = 'deterministic';

export const describeRuntimeMode = (mode: UiRuntimeMode): Readonly<{ label: string; description: string }> =>
  mode === 'runtime'
    ? { label: 'Runtime', description: 'Uses the versioned API when the canonical store is available.' }
    : { label: 'Deterministic', description: 'Uses the local seeded browser store with reproducible retrieval traces.' };

export const initialRuntimeHealth = (): RuntimeHealth => ({ status: 'unknown', message: 'Health has not been checked.' });

