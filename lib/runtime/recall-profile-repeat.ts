export type RecallProfileSample = Readonly<{ request: Readonly<{ failures: number; p95Ms: number; stageTimings?: Readonly<Record<string, Readonly<{ p95Ms: number }>>> }> }>;

const percentile = (values: readonly number[], fraction: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
};

export const summarizeRepeatedRecallProfiles = (reports: readonly RecallProfileSample[]) => {
  const runP95Ms = reports.map((report) => report.request.p95Ms);
  const failedRequests = reports.reduce((total, report) => total + report.request.failures, 0);
  const maxRunP95Ms = Math.max(...runP95Ms, 0);
  const stageP95MsByRun: Record<string, number[]> = {};
  for (const report of reports) {
    for (const [stage, timing] of Object.entries(report.request.stageTimings ?? {})) {
      (stageP95MsByRun[stage] ??= []).push(timing.p95Ms);
    }
  }
  return {
    runs: reports.length,
    runP95Ms,
    failedRequests,
    p50OfRunP95Ms: percentile(runP95Ms, 0.5),
    p95OfRunP95Ms: percentile(runP95Ms, 0.95),
    p99OfRunP95Ms: percentile(runP95Ms, 0.99),
    maxRunP95Ms,
    stageP95MsByRun,
    sloTargetMs: 500,
    sloPassed: reports.length > 0 && failedRequests === 0 && maxRunP95Ms < 500,
  };
};
