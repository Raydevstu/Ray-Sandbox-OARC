import type { ProjectEvent, ProjectMemoryRecord } from './contracts';

export type ProjectMemoryProjection = Readonly<{ records: Readonly<Record<string, ProjectMemoryRecord>> }>;
export const emptyProjectMemoryProjection = (): ProjectMemoryProjection => ({ records: {} });
export const applyProjectEvent = (projection: ProjectMemoryProjection, event: ProjectEvent): ProjectMemoryProjection => {
  if (event.type === 'ProjectMemoryRecorded') {
    const record = event.payload.record as ProjectMemoryRecord;
    return { records: { ...projection.records, [record.id]: record } };
  }
  if (event.type === 'ProjectMemoryStatusChanged') {
    const id = String(event.payload.recordId);
    const current = projection.records[id];
    if (!current) return projection;
    return { records: { ...projection.records, [id]: { ...current, status: event.payload.status as ProjectMemoryRecord['status'], updatedAt: event.occurredAt } } };
  }
  return projection;
};
export const replayProjectMemory = (events: readonly ProjectEvent[]): ProjectMemoryProjection => events.slice().sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id)).reduce(applyProjectEvent, emptyProjectMemoryProjection());
export const replayProjectMemoryAtSequence = (events: readonly ProjectEvent[], atSequence?: number): ProjectMemoryProjection => replayProjectMemory(atSequence ? events.filter((event) => event.sequence <= atSequence) : events);
