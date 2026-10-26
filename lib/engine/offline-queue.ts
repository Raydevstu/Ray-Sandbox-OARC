import type { CanonicalIntegrationEvent, OfflineQueueEntry } from "@/lib/types";

export function enqueueEvent(queue: OfflineQueueEntry[], event: CanonicalIntegrationEvent): OfflineQueueEntry[] {
  if (queue.some((entry) => entry.event.id === event.id)) return queue;
  return [...queue, { id: `queue-${event.id}`, event, status: "pending" as const, attempts: 0 }].slice(-100);
}

export function replayQueue(queue: OfflineQueueEntry[], policy: { failEventIds: string[] }): { queue: OfflineQueueEntry[]; delivered: CanonicalIntegrationEvent[]; errors: string[] } {
  const delivered: CanonicalIntegrationEvent[] = [];
  const errors: string[] = [];
  const remaining: OfflineQueueEntry[] = [];
  for (const entry of queue) {
    if (entry.status !== "pending") { remaining.push(entry); continue; }
    if (policy.failEventIds.includes(entry.event.id)) { errors.push(`${entry.event.id}: simulated delivery failure`); remaining.push({ ...entry, status: "failed", attempts: entry.attempts + 1, error: errors.at(-1) }); continue; }
    delivered.push(entry.event);
  }
  return { queue: remaining, delivered, errors };
}
