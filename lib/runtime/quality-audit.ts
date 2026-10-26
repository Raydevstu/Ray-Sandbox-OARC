type EvidenceBearingRecord = Readonly<{ id: string; evidence?: readonly Readonly<{ reference?: string }> [] }>;
type LedgerEvent = Readonly<{ id: string; type: string; payload: Readonly<Record<string, unknown>> }>;

const percentile = (values: readonly number[], rank: number): number => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * rank) - 1)] ?? 0;
};

export const auditDerivedMemoryProvenance = (records: readonly EvidenceBearingRecord[]) => {
  const missingRecordIds = records.filter((record) => !record.evidence?.some((evidence) => Boolean(evidence.reference))).map((record) => record.id);
  return { total: records.length, linked: records.length - missingRecordIds.length, missingRecordIds, coverage: records.length ? (records.length - missingRecordIds.length) / records.length : 1 };
};

export const auditMutationLedger = (events: readonly LedgerEvent[], mutationIds: readonly string[]) => {
  const represented = new Set(events.flatMap((event) => [String(event.payload.mutationId ?? ''), String(event.payload.eventId ?? ''), String(event.payload.recordId ?? ''), String((event.payload.record as { id?: string } | undefined)?.id ?? ''), String((event.payload.conversation as { messageId?: string } | undefined)?.messageId ?? ''), String((event.payload.source as { messageId?: string } | undefined)?.messageId ?? ''), event.id].filter(Boolean)));
  const missingMutationIds = mutationIds.filter((id) => !represented.has(id));
  return { totalMutations: mutationIds.length, represented: mutationIds.length - missingMutationIds.length, missingMutationIds, coverage: mutationIds.length ? (mutationIds.length - missingMutationIds.length) / mutationIds.length : 1 };
};

export const summarizeSloMeasurements = (measurements: Readonly<{ recall: readonly number[]; retain: readonly number[]; queueDelay: readonly number[]; workerCompletionWithin60s: readonly boolean[] }>) => ({
  recall: { p50Ms: percentile(measurements.recall, 0.5), p95Ms: percentile(measurements.recall, 0.95), p99Ms: percentile(measurements.recall, 0.99) },
  retain: { p50Ms: percentile(measurements.retain, 0.5), p95Ms: percentile(measurements.retain, 0.95), p99Ms: percentile(measurements.retain, 0.99) },
  queueDelay: { p50Ms: percentile(measurements.queueDelay, 0.5), p95Ms: percentile(measurements.queueDelay, 0.95), p99Ms: percentile(measurements.queueDelay, 0.99) },
  workerCompletionRate: measurements.workerCompletionWithin60s.filter(Boolean).length / Math.max(1, measurements.workerCompletionWithin60s.length),
});
