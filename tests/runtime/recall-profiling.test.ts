import { describe, expect, it } from 'vitest';
import { createRecallProfiler, formatRecallTiming } from '../../lib/runtime/recall-profiling';
import { createReadExecutor } from '../../lib/runtime/repository';

describe('recall profiling', () => {
  it('records redacted stage durations and pool wait state', () => {
    const profiler = createRecallProfiler(true);
    const start = performance.now();
    profiler.mark('auth', start + 10);
    profiler.mark('scope', start + 12);
    profiler.mark('connection', start + 20, { poolWaiting: 3, poolTotal: 5 });
    profiler.mark('query', start + 24, { poolWaiting: 3, poolTotal: 5 });
    profiler.mark('response', start + 25);

    const snapshot = profiler.snapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.stages).toMatchObject({ scope: 2, connection: 8, query: 4, response: 1 });
    expect(snapshot.stages.auth).toBeCloseTo(10, 0);
    expect(snapshot.pool).toEqual({ waiting: 3, total: 5 });
    expect(formatRecallTiming(profiler.snapshot())).toContain('connection=8ms');
    expect(formatRecallTiming(profiler.snapshot())).toContain('query=4ms');
  });

  it('records redacted client-lease sequence and wait age', () => {
    const profiler = createRecallProfiler(true);
    profiler.recordLease(17, 42);
    expect(profiler.snapshot().lease).toEqual({ sequence: 42, waitMs: 17 });
  });

  it('does not collect timings when disabled', () => {
    const profiler = createRecallProfiler(false);
    profiler.mark('auth', 10);
    expect(profiler.snapshot()).toEqual({ enabled: false, stages: {}, pool: null });
  });

  it('separates profiled connection acquisition from query execution and releases the client', async () => {
    let released = false;
    let poolQueries = 0;
    const pool = {
      waitingCount: 2,
      totalCount: 5,
      async connect() {
        return {
          async query() { return { rows: [{ id: 'fact-1' }] }; },
          release() { released = true; },
        };
      },
      async query() { poolQueries += 1; return { rows: [] }; },
    };
    const profiler = createRecallProfiler(true);

    const rows = await createReadExecutor(pool, profiler)('SELECT id FROM facts', []);

    expect(rows).toEqual([{ id: 'fact-1' }]);
    expect(released).toBe(true);
    expect(poolQueries).toBe(0);
    expect(profiler.snapshot().stages).toMatchObject({ connection: expect.any(Number), query: expect.any(Number) });
  });

  it('keeps the regular pool query path when recall profiling is disabled', async () => {
    let poolQueries = 0;
    const pool = {
      waitingCount: 0,
      totalCount: 1,
      async connect() { throw new Error('should not acquire a client'); },
      async query() { poolQueries += 1; return { rows: [{ id: 'fact-2' }] }; },
    };

    const rows = await createReadExecutor(pool)('SELECT id FROM facts', []);

    expect(rows).toEqual([{ id: 'fact-2' }]);
    expect(poolQueries).toBe(1);
  });
});
