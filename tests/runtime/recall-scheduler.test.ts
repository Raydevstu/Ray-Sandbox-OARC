import { describe, expect, it } from 'vitest';
import { createRecallScheduler } from '../../lib/runtime/recall-scheduler';

describe('recall scheduler', () => {
  it('limits active recall work and preserves FIFO admission', async () => {
    const scheduler = createRecallScheduler(1);
    let release!: (value?: unknown) => void;
    const first = scheduler.run(() => new Promise((resolve) => { release = resolve; }));
    const second = scheduler.run(async () => 'second');
    expect(scheduler.snapshot()).toEqual({ active: 1, queued: 1, limit: 1 });
    release();
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBe('second');
    expect(scheduler.snapshot()).toEqual({ active: 0, queued: 0, limit: 1 });
  });
});
