import type { CanonicalRepository } from '../repositories/interfaces';
import { createEventEnvelope, createOutboxRecord } from '../events/envelope';
import type { MemoryScope } from '../contracts';

export const updateMemory = async (scope: MemoryScope & Readonly<{ projectId?: string }>, factId: string, claim: string, repository: CanonicalRepository) => {
  const normalized = claim.trim();
  if (!normalized) throw new Error('text is required');
  const current = (await repository.findFacts(scope)).find((fact) => fact.id === factId);
  if (!current) throw new Error('memory not found');
  const revision = { ...current, revision: current.revision + 1, claim: normalized, createdAt: new Date().toISOString() };
  const idempotencyKey = `memory-correction:${scope.tenantId}:${scope.bankId}:${factId}:${revision.revision}:${normalized}`;
  if (await repository.getByIdempotencyKey(scope, idempotencyKey)) return revision;
  const event = createEventEnvelope({ ...scope, type: 'MemoryCorrected', occurredAt: revision.createdAt, idempotencyKey, payload: { factId, revision, supersedesRevision: current.revision } });
  await repository.appendRevision(revision);
  await repository.appendEvent(event);
  await repository.appendOutbox(createOutboxRecord(event, idempotencyKey));
  return revision;
};

export const deleteMemory = async (scope: MemoryScope, factId: string, repository: CanonicalRepository) => {
  const current = (await repository.findFacts(scope)).find((fact) => fact.id === factId);
  if (!current) throw new Error('memory not found');
  await repository.tombstoneFact(scope, factId, new Date().toISOString());
  return { id: factId, deleted: true };
};

export const listEntities = (scope: MemoryScope, limit: number, repository: CanonicalRepository) => repository.listEntities(scope, Math.max(1, Math.min(100, Math.floor(limit))));
