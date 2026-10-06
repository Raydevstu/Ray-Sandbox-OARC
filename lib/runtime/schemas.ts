import { z } from 'zod';

const memoryScopeShape = { tenantId: z.string().trim().min(1), bankId: z.string().trim().min(1) };
const scoped = z.object(memoryScopeShape);
export const MemoryScopeSchema = scoped.readonly();
export const RetrievalRequestSchema = scoped.extend({ query: z.string().trim().min(1), limit: z.number().int().positive().max(100).optional() });
export const MemoryFactRevisionSchema = scoped.extend({ id: z.string().min(1), revision: z.number().int().positive(), claim: z.string().min(1), confidence: z.number().min(0).max(1), evidenceIds: z.array(z.string().min(1)), createdAt: z.string().datetime() });
export const EvidenceRecordSchema = scoped.extend({ id: z.string().min(1), source: z.string().min(1), content: z.string().min(1), provenance: z.string().min(1), createdAt: z.string().datetime() });
export const EventRecordSchema = scoped.extend({ id: z.string().min(1), type: z.string().min(1), payload: z.record(z.string(), z.unknown()), occurredAt: z.string().datetime() });
export const OutboxRecordSchema = scoped.extend({ id: z.string().min(1), eventId: z.string().min(1), idempotencyKey: z.string().min(1), status: z.enum(['pending', 'published']) });
export const RetrievalResponseSchema = z.object({ facts: z.array(MemoryFactRevisionSchema), traceId: z.string().min(1) });
export const HealthReportSchema = z.object({ status: z.enum(['ok', 'degraded']), checks: z.record(z.string(), z.boolean()) });
