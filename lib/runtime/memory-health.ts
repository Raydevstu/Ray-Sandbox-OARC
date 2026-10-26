export type MemoryHealthStatus = 'empty' | 'queued' | 'healthy' | 'degraded' | 'unavailable' | 'failed';
export type MemoryHealth = Readonly<{ status: MemoryHealthStatus; label: string; detail: string }>;

export function deriveMemoryHealth(input: Readonly<{ records: number; pending: number; failures: number; store: 'healthy' | 'unavailable' | 'failed' }>): MemoryHealth {
  if (input.store === 'failed') return { status: 'failed', label: 'Memory unavailable', detail: 'The memory service reported a failure. Try again or contact an operator.' };
  if (input.store === 'unavailable') return { status: 'unavailable', label: 'Memory offline', detail: 'The durable memory store is unavailable. Your workspace is still safe to inspect.' };
  if (input.failures > 0) return { status: 'degraded', label: 'Memory degraded', detail: `${input.failures} recent operation${input.failures === 1 ? '' : 's'} need attention.` };
  if (input.pending > 0) return { status: 'queued', label: 'Memory processing', detail: `${input.pending} item${input.pending === 1 ? '' : 's'} are still being processed.` };
  if (input.records === 0) return { status: 'empty', label: 'Memory is empty', detail: 'Connect an agent or retain your first conversation to get started.' };
  return { status: 'healthy', label: 'Memory healthy', detail: `${input.records} durable memor${input.records === 1 ? 'y' : 'ies'} are available.` };
}
