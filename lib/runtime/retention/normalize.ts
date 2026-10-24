import { stableId } from '../../runtime/contracts';
import type { EvidenceRecord, MemoryFactRevision, MemoryScope } from '../contracts';

export type RetainRequest = MemoryScope & Readonly<{ projectId?: string; workflowRunId?: string; content: string; source: string; provenance: string; occurredAt?: string; idempotencyKey: string }>;
export const normalizeSource = (input: RetainRequest): RetainRequest => ({ ...input, content: input.content.trim(), source: input.source.trim(), provenance: input.provenance.trim() });
export const buildEvidence = (input: RetainRequest, now: string): EvidenceRecord => ({ tenantId: input.tenantId, bankId: input.bankId, id: stableId('evidence', input.tenantId, input.bankId, input.idempotencyKey), source: input.source, content: input.content, provenance: input.provenance, createdAt: now });
export const buildFact = (input: RetainRequest, evidence: EvidenceRecord, now: string): MemoryFactRevision => ({ tenantId: input.tenantId, bankId: input.bankId, ...(input.projectId ? { projectId: input.projectId } : {}), id: stableId('fact', input.tenantId, input.bankId, input.idempotencyKey), revision: 1, claim: input.content, confidence: 0.7, evidenceIds: [evidence.id], createdAt: input.occurredAt ?? now });
