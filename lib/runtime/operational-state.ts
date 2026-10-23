export const operationalStates = ['empty', 'queued', 'healthy', 'degraded', 'unavailable', 'failed', 'unauthorized'] as const;

export type OperationalState = typeof operationalStates[number];

export type OperationalEnvelope<T> = Readonly<{
  ok: boolean;
  requestId: string;
  data?: T;
  error?: string;
  retryable?: boolean;
  state: OperationalState;
}>;

export type OperationalStateInput = Readonly<{
  ok: boolean;
  status: number;
  resultCount?: number;
  degraded?: boolean;
  retryable?: boolean;
}>;

export const classifyOperationalState = (input: OperationalStateInput): OperationalState => {
  if (input.status === 401 || input.status === 403) return 'unauthorized';
  if (input.status === 503) return 'unavailable';
  if (!input.ok) return 'failed';
  if (input.status === 202) return 'queued';
  if (input.degraded) return 'degraded';
  if (input.resultCount === 0) return 'empty';
  return 'healthy';
};
