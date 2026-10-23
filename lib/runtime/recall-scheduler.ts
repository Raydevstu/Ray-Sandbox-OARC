type Waiter<T> = { task: () => Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

export const recallConcurrencyFromEnv = (env: Record<string, string | undefined>): number => {
  const value = Number.parseInt(env.APEX_RECALL_CONCURRENCY ?? '', 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(50, value)) : 100;
};

export const createRecallScheduler = (limit: number) => {
  const max = Math.max(1, Math.min(50, Math.floor(limit)));
  const queue: Waiter<unknown>[] = [];
  let active = 0;
  const drain = () => {
    while (active < max && queue.length) {
      const waiter = queue.shift()!;
      active += 1;
      void waiter.task().then(waiter.resolve, waiter.reject).finally(() => { active -= 1; drain(); });
    }
  };
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => { queue.push({ task, resolve: resolve as (value: unknown) => void, reject }); drain(); });
    },
    snapshot: () => ({ active, queued: queue.length, limit: max }),
  };
};
