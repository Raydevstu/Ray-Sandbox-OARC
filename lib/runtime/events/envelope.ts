import { stableId } from '../../runtime/contracts';
import type { EventRecord, MemoryScope, OutboxRecord } from '../contracts';

export type EventInput<T extends Readonly<Record<string, unknown>>> = MemoryScope & Readonly<{ type: string; payload: T; occurredAt: string; idempotencyKey: string }>;
export const createEventEnvelope = <T extends Readonly<Record<string, unknown>>>(input: EventInput<T>): EventRecord => ({ tenantId: input.tenantId, bankId: input.bankId, id: stableId('event', input.tenantId, input.bankId, input.idempotencyKey), type: input.type, payload: input.payload, occurredAt: input.occurredAt });
export const createOutboxRecord = (event: EventRecord, idempotencyKey: string): OutboxRecord => ({ tenantId: event.tenantId, bankId: event.bankId, id: stableId('outbox', event.id), eventId: event.id, idempotencyKey, status: 'pending' });
