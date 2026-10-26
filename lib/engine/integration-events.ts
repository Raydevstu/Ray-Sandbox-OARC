import type { CanonicalIntegrationEvent, IntegrationEventType, SandboxEvent } from "@/lib/types";

const OP_TYPES: Record<SandboxEvent["op"], IntegrationEventType> = {
  retain: "memory.retained", recall: "memory.recalled", reflect: "memory.reflected", consolidate: "memory.retained",
  reinforce: "memory.reflected", learn: "pipeline.run", orchestrate: "pipeline.run", system: "pipeline.run",
};

export function createIntegrationEvent(input: { type: IntegrationEventType; payload: Record<string, unknown>; at?: string; id?: string; app?: string; source?: string }): CanonicalIntegrationEvent {
  const at = input.at ?? new Date().toISOString();
  return { id: input.id ?? `int-${at.replace(/\D/g, "").slice(0, 14)}-${JSON.stringify(input.payload).length}`, version: 1, type: input.type, at, payload: { ...input.payload }, provenance: { app: input.app ?? "sandbox", source: input.source ?? "canonical-event" } };
}

export function normalizeSandboxEvent(event: SandboxEvent): CanonicalIntegrationEvent {
  return createIntegrationEvent({ id: event.id, at: event.at, type: OP_TYPES[event.op], app: event.app, source: "sandbox-event", payload: { message: event.message, ...(event.tokens === undefined ? {} : { tokens: event.tokens }), operation: event.op } });
}
