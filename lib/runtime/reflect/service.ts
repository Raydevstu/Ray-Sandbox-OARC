import { stableId, type MemoryScope } from '../contracts';
import { recallMemory } from '../retrieval';
import type { CanonicalRepository } from '../repositories/interfaces';
import { createEventEnvelope, createOutboxRecord } from '../events/envelope';

export const reflectMemory = async (scope: MemoryScope, query: string, repository: CanonicalRepository) => {
  const result = await recallMemory({ ...scope, query, limit: 8, tokenBudget: 1000, policy: 'current' }, repository);
  const memories = result.facts.map((fact, index) => ({ id: fact.id, claim: fact.claim, confidence: fact.confidence, citation: `[${index + 1}]` }));
  const evidence = memories.map((memory) => `${memory.citation} ${memory.claim}`).join('; ');
  const response = evidence ? `Based on the recalled memories: ${evidence}.` : `I do not have enough evidence in this bank to answer "${query}" confidently.`;
  const opinion = /\b(should|best|better|prefer|recommend|opinion|think|feel|worth|favorite|advice)\b/i.test(query) && memories.length
    ? [{ id: stableId('opinion', scope.tenantId, scope.bankId, query), text: `Grounded view on ${query}: ${memories[0].claim}`, confidence: Number(Math.min(0.95, 0.5 + memories.length * 0.07).toFixed(2)) }]
    : [];
  const idempotencyKey = `reflect:${stableId(scope.tenantId, scope.bankId, query)}`;
  if (!(await repository.getByIdempotencyKey(scope, idempotencyKey))) {
    const event = createEventEnvelope({ tenantId: scope.tenantId, bankId: scope.bankId, type: 'MemoryReflected', occurredAt: new Date().toISOString(), idempotencyKey, payload: { query, response, opinions: opinion, traceId: result.traceId, tokensUsed: result.packed.tokens } });
    await repository.appendEvent(event);
    await repository.appendOutbox(createOutboxRecord(event, idempotencyKey));
  }
  return { response, query, memories, opinions: opinion, traceId: result.traceId, tokensUsed: result.packed.tokens };
};
