import { describe, expect, it } from 'vitest';
import { deriveMemoryHealth } from '../../lib/runtime/memory-health';

describe('memory health summary', () => {
  it('reports empty when no memories exist', () => expect(deriveMemoryHealth({ records: 0, pending: 0, failures: 0, store: 'healthy' })).toMatchObject({ status: 'empty' }));
  it('reports queued before healthy while work is pending', () => expect(deriveMemoryHealth({ records: 2, pending: 1, failures: 0, store: 'healthy' })).toMatchObject({ status: 'queued' }));
  it('reports degraded for failures and unavailable for a missing store', () => {
    expect(deriveMemoryHealth({ records: 2, pending: 0, failures: 1, store: 'healthy' })).toMatchObject({ status: 'degraded' });
    expect(deriveMemoryHealth({ records: 2, pending: 0, failures: 0, store: 'unavailable' })).toMatchObject({ status: 'unavailable' });
  });
});
