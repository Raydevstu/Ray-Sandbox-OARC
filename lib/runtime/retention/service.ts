import { EventRecordSchema, MemoryFactRevisionSchema, EvidenceRecordSchema } from '../schemas';
import type { EventRecord, MemoryFactRevision, EvidenceRecord } from '../contracts';
import type { CanonicalRepository } from '../repositories/interfaces';
import { createEventEnvelope, createOutboxRecord } from '../events/envelope';
import { buildEvidence, buildFact, normalizeSource, type RetainRequest } from './normalize';

export type RetainResponse = Readonly<{ fact: MemoryFactRevision; evidence: EvidenceRecord; event: EventRecord; replayed: boolean }>;
export const retainMemory = async (input: RetainRequest, repository: CanonicalRepository, now = new Date().toISOString()): Promise<RetainResponse> => {
  const normalized = normalizeSource(input);
  if (!normalized.content || !normalized.source || !normalized.provenance || !normalized.idempotencyKey) throw new Error('content, source, provenance, and idempotencyKey are required');
  const existing = await repository.getByIdempotencyKey(normalized, normalized.idempotencyKey);
  if (existing) { if (existing.payload.content !== normalized.content) throw new Error('idempotency key payload conflict'); const fact = existing.payload.fact as MemoryFactRevision; const evidence = existing.payload.evidence as EvidenceRecord; return { fact, evidence, event: existing, replayed: true }; }
  const evidence = EvidenceRecordSchema.parse(buildEvidence(normalized, now));
  const fact = MemoryFactRevisionSchema.parse(buildFact(normalized, evidence, now));
  const event = EventRecordSchema.parse(createEventEnvelope({ ...normalized, type: 'MemoryRetained', occurredAt: now, payload: { content: normalized.content, fact, evidence } }));
  await repository.retainMemoryAtomic(evidence, fact, event, createOutboxRecord(event, normalized.idempotencyKey));
  return { fact, evidence, event, replayed: false };
};
