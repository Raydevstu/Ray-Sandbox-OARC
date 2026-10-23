export type RecallStage = 'auth' | 'scope' | 'authorize' | 'queue' | 'repository' | 'parse' | 'connection' | 'query' | 'response';

export type RecallTiming = {
  enabled: boolean;
  stages: Partial<Record<RecallStage, number>>;
  pool: { waiting: number; total: number } | null;
  lease?: { sequence: number; waitMs: number };
};
export type RecallProfiler = ReturnType<typeof createRecallProfiler>;

export const createRecallProfiler = (enabled: boolean) => {
  const stages: Partial<Record<RecallStage, number>> = {};
  let previous = performance.now();
  let pool: RecallTiming['pool'] = null;
  let lease: RecallTiming['lease'];
  return {
    mark(stage: RecallStage, now = performance.now(), state?: { poolWaiting: number; poolTotal: number }) {
      if (!enabled) return;
      stages[stage] = Math.max(0, Math.round((now - previous) * 100) / 100);
      previous = now;
      if (state) pool = { waiting: state.poolWaiting, total: state.poolTotal };
    },
    recordLease(waitMs: number, sequence: number) { if (enabled) lease = { sequence, waitMs: Math.max(0, Math.round(waitMs * 100) / 100) }; },
    snapshot(): RecallTiming { return { enabled, stages, pool, ...(lease ? { lease } : {}) }; },
  };
};

export const formatRecallTiming = (timing: RecallTiming): string => {
  if (!timing.enabled) return '';
  const stages = Object.entries(timing.stages).map(([key, value]) => `${key}=${value}ms`).join(',');
  const pool = timing.pool ? `;poolWaiting=${timing.pool.waiting};poolTotal=${timing.pool.total}` : '';
  return `${stages}${pool}`;
};
