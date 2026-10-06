import type { EventRecord } from '../contracts';
export type IntegrationTarget = Readonly<{ kind: 'webhook' | 'codex' | 'claude-code' | 'openclaw' | 'hermes' | 'n8n' | 'zapier'; mode: 'simulated' | 'live' }>;
export type IntegrationPayload = Readonly<{ target: IntegrationTarget['kind']; delivery: IntegrationTarget['mode']; eventId: string; eventType: string; scope: Readonly<{ tenantId: string; bankId: string }>; data: Readonly<Record<string, unknown>> }>;
const secretKeys = new Set(['token', 'secret', 'authorization', 'apiKey', 'password']);
const redact = (value: unknown): unknown => Array.isArray(value) ? value.map(redact) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !secretKeys.has(key)).map(([key, child]) => [key, redact(child)])) : value;
export const buildIntegrationPayload = (event: EventRecord, target: IntegrationTarget): IntegrationPayload => ({ target: target.kind, delivery: target.mode, eventId: event.id, eventType: event.type, scope: { tenantId: event.tenantId, bankId: event.bankId }, data: redact(event.payload) as Readonly<Record<string, unknown>> });
