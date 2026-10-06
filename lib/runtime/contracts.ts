import { createHash } from 'node:crypto';

export type MemoryScope = { readonly tenantId: string; readonly bankId: string };
export type MemoryFactRevision = MemoryScope & { readonly id: string; readonly revision: number; readonly claim: string; readonly confidence: number; readonly evidenceIds: readonly string[]; readonly createdAt: string };
export type EvidenceRecord = MemoryScope & { readonly id: string; readonly source: string; readonly content: string; readonly provenance: string; readonly createdAt: string };
export type EventRecord = MemoryScope & { readonly id: string; readonly type: string; readonly payload: Readonly<Record<string, unknown>>; readonly occurredAt: string };
export type OutboxRecord = MemoryScope & { readonly id: string; readonly eventId: string; readonly idempotencyKey: string; readonly status: 'pending' | 'published' };
export type RetrievalRequest = MemoryScope & { readonly query: string; readonly limit?: number };
export type RetrievalResponse = { readonly facts: readonly MemoryFactRevision[]; readonly traceId: string };
export type HealthReport = { readonly status: 'ok' | 'degraded'; readonly checks: Readonly<Record<string, boolean>> };

export const stableId = (...parts: readonly string[]): string => createHash('sha256').update(parts.join('\0')).digest('hex');
