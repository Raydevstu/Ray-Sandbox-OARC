import { createHash } from 'node:crypto';

export type MemoryScope = { readonly tenantId: string; readonly bankId: string };
export type MemoryIdentityScope = Readonly<{ userId?: string; agentId?: string; appId?: string; runId?: string }>;
export type MemoryFactRevision = MemoryScope & { readonly id: string; readonly revision: number; readonly claim: string; readonly confidence: number; readonly evidenceIds: readonly string[]; readonly createdAt: string };
export type EvidenceRecord = MemoryScope & { readonly id: string; readonly source: string; readonly content: string; readonly provenance: string; readonly createdAt: string };
export type EventRecord = MemoryScope & { readonly id: string; readonly type: string; readonly payload: Readonly<Record<string, unknown>>; readonly occurredAt: string };
export type ProjectMemoryType = 'requirement' | 'decision' | 'implementation' | 'test' | 'benchmark' | 'runtime' | 'risk' | 'blocker' | 'follow_up' | 'document_reference';
export type ProjectMemoryStatus = 'active' | 'superseded' | 'pending' | 'verified' | 'blocked' | 'stale' | 'conflict' | 'uncertain';
export type EvidenceKind = 'conversation' | 'file' | 'test' | 'http' | 'database' | 'browser' | 'commit' | 'runtime' | 'decision';
export type ProjectMemoryEvidence = Readonly<{ kind: EvidenceKind; reference: string; observedAt: string }>;
export type ProjectMemorySource = Readonly<{ platform: string; conversationId?: string; messageId?: string; filePath?: string; commit?: string; timestamp: string }>;
export type ProjectMemoryRecord = MemoryScope & Readonly<{ id: string; projectId: string; identity?: MemoryIdentityScope; type: ProjectMemoryType; title: string; content: string; status: ProjectMemoryStatus; confidence: number; importance: 'critical' | 'high' | 'normal' | 'low'; source: ProjectMemorySource; evidence: readonly ProjectMemoryEvidence[]; supersedes: readonly string[]; relatedRecords: readonly string[]; createdAt: string; updatedAt: string }>;
export type ConversationEvent = MemoryScope & Readonly<{ projectId: string; platform: string; conversationId: string; messageId: string; role: 'user' | 'assistant' | 'tool' | 'system'; content: string; timestamp: string; attachments?: readonly string[]; toolCalls?: readonly unknown[] }>;
export type ProjectEvent = MemoryScope & Readonly<{ id: string; projectId: string; type: string; payload: Readonly<Record<string, unknown>>; occurredAt: string; sequence: number }>;
export type OutboxRecord = MemoryScope & { readonly id: string; readonly eventId: string; readonly idempotencyKey: string; readonly status: 'pending' | 'published' };
export type RetrievalRequest = MemoryScope & { readonly query: string; readonly limit?: number };
export type RetrievalResponse = { readonly facts: readonly MemoryFactRevision[]; readonly traceId: string };
export type EntitySummary = Readonly<{ id: string; label: string; degree: number; topCooccur: readonly string[] }>;
export type HealthReport = { readonly status: 'ok' | 'degraded'; readonly checks: Readonly<Record<string, boolean>> };

export const stableId = (...parts: readonly string[]): string => {
  const input = parts.map((part) => `${part.length}:${part}`).join('|');
  return createHash('sha256').update(input).digest('hex');
};
