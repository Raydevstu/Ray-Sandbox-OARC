import type { JobHealth } from './repositories/interfaces';

export type OperationsStatus = Readonly<{
  status: 'ok' | 'degraded';
  activeFailure: boolean;
  historicalLastError: string | null;
}>;

export const deriveOperationsStatus = (jobs: JobHealth): OperationsStatus => {
  const activeFailure = jobs.pending > 0 || jobs.running > 0 || jobs.deadLetter > 0;
  return {
    status: activeFailure ? 'degraded' : 'ok',
    activeFailure,
    historicalLastError: jobs.lastError,
  };
};
