import { createHash } from 'node:crypto';

export type MemoryScope = { readonly tenantId: string; readonly bankId: string };
export type RequestContext = Readonly<{ tenantId: string; bankId: string; projectId?: string; correlationId?: string; requestId?: string; idempotencyKey?: string }>;
export type Project = MemoryScope & Readonly<{ projectId: string; name?: string; createdAt: string; updatedAt: string }>;
export type Source = MemoryScope & Readonly<{ sourceId: string; projectId?: string; kind: string; provenance: string; createdAt: string }>;
export type PromptVersion = MemoryScope & Readonly<{ promptId: string; version: number; projectId?: string; content: string; createdAt: string }>;
export type ContextConfig = MemoryScope & Readonly<{ configId: string; projectId: string; version: number; settings: Readonly<Record<string, unknown>>; updatedAt: string }>;
export type Phase3DomainRecord = MemoryScope & Readonly<{ projectId: string; kind: 'learning_episode' | 'orchestrator_graph'; recordId: string; payload: Readonly<Record<string, unknown>>; updatedAt: string }>;
export type GraphRun = MemoryScope & Readonly<{ graphRunId: string; projectId?: string; status: 'queued' | 'running' | 'completed' | 'failed'; createdAt: string }>;
export type EvaluationRun = MemoryScope & Readonly<{ evaluationRunId: string; projectId: string; status: 'queued' | 'running' | 'completed' | 'failed'; createdAt: string }>;
export type Trace = MemoryScope & Readonly<{ traceId: string; projectId?: string; workflowRunId?: string; createdAt: string }>;
export type Revision = MemoryScope & Readonly<{ revisionId: string; recordId: string; projectId?: string; createdAt: string }>;
export type MemoryIdentityScope = Readonly<{ userId?: string; agentId?: string; appId?: string; runId?: string }>;
export type MemoryFactRevision = MemoryScope & { readonly projectId?: string; readonly id: string; readonly revision: number; readonly claim: string; readonly confidence: number; readonly evidenceIds: readonly string[]; readonly createdAt: string };
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
export type WorkflowEnvelope<T> = Readonly<{ ok: boolean; requestId: string; workflowRunId?: string; state?: 'healthy' | 'empty' | 'queued' | 'degraded' | 'unavailable' | 'unauthorized' | 'failed'; data?: T; trace?: Readonly<Record<string, unknown>>; error?: string; retryable?: boolean }>;
export type RetrievalRequest = MemoryScope & { readonly projectId?: string; readonly query: string; readonly limit?: number; readonly workflowRunId?: string };
export type RetrievalResponse = { readonly facts: readonly MemoryFactRevision[]; readonly traceId: string };
export type WorkflowRunStatus = 'active' | 'completed' | 'failed' | 'degraded';
export type WorkflowRun = MemoryScope & Readonly<{ workflowRunId: string; projectId: string; mode: 'sample' | 'real'; currentStep: string; completedSteps: readonly string[]; status: WorkflowRunStatus; createdAt: string; updatedAt: string; lastTraceId?: string; lastEventId?: string }>;
export type EntitySummary = Readonly<{ id: string; label: string; degree: number; topCooccur: readonly string[] }>;
export type HealthReport = { readonly status: 'ok' | 'degraded'; readonly checks: Readonly<Record<string, boolean>> };

export const stableId = (...parts: readonly string[]): string => {
  const input = parts.map((part) => `${part.length}:${part}`).join('|');
  return createHash('sha256').update(input).digest('hex');
};
