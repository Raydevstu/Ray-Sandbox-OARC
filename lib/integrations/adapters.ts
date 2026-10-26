import type { CanonicalIntegrationEvent } from "@/lib/types";

export interface AdapterExample { name: "n8n" | "Zapier" | "MCP"; description: string; payload: Record<string, unknown>; simulated: true; }

export function buildAdapterExamples(event: CanonicalIntegrationEvent): AdapterExample[] {
  const base = { event_id: event.id, event_type: event.type, occurred_at: event.at, provenance: event.provenance, payload: event.payload };
  return [
    { name: "n8n", description: "Webhook trigger body for an n8n workflow", payload: { ...base, trigger: "webhook" }, simulated: true },
    { name: "Zapier", description: "Catch Hook fields for a Zap", payload: { ...base, trigger: "catch-hook" }, simulated: true },
    { name: "MCP", description: "Tool-host event envelope for an MCP consumer", payload: { ...base, method: "notifications/memory.event" }, simulated: true },
  ];
}
