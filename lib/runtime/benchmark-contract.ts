export const BENCHMARK_MODES = ['without-memory', 'local-memory', 'postgres-memory', 'manifest-memory'] as const;
export type BenchmarkMode = typeof BENCHMARK_MODES[number];
export type CaptureMeasurement = 'captured' | 'partial' | 'uncaptured';

export type BenchmarkCaseResult = Readonly<{
  caseId: string;
  mode: BenchmarkMode;
  answerScore: number;
  citationPrecision: number;
  unsupportedClaimRate: number;
  latencyMs: number;
  retrievalLatencyMs: number;
  queueDelayMs: number;
  inputTokens?: number;
  outputTokens?: number;
  persisted: boolean;
  captureStatus: CaptureMeasurement;
}>;

export type ControlledBenchmarkRun = Readonly<{
  id: string;
  generatedAt: string;
  corpusId: string;
  modelId: string;
  promptVersion: string;
  cases: readonly BenchmarkCaseResult[];
  evidence: 'synthetic' | 'live-codex' | 'replay';
}>;

const finiteRate = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
const finiteDuration = (value: number): boolean => Number.isFinite(value) && value >= 0;

export function validateBenchmarkCase(result: BenchmarkCaseResult): void {
  if (!result.caseId.trim()) throw new Error('benchmark caseId is required');
  if (!BENCHMARK_MODES.includes(result.mode)) throw new Error('unsupported benchmark mode');
  for (const [name, value] of [['answerScore', result.answerScore], ['citationPrecision', result.citationPrecision], ['unsupportedClaimRate', result.unsupportedClaimRate]] as const) if (!finiteRate(value)) throw new Error(`${name} must be between 0 and 1`);
  for (const [name, value] of [['latencyMs', result.latencyMs], ['retrievalLatencyMs', result.retrievalLatencyMs], ['queueDelayMs', result.queueDelayMs]] as const) if (!finiteDuration(value)) throw new Error(`${name} must be a non-negative finite number`);
  if (result.mode === 'without-memory' && (result.persisted || result.captureStatus !== 'uncaptured')) throw new Error('without-memory cases cannot claim persistence or capture');
}

export function validateControlledBenchmark(run: ControlledBenchmarkRun): void {
  if (!run.id.trim() || !run.corpusId.trim() || !run.modelId.trim() || !run.promptVersion.trim()) throw new Error('benchmark identity is incomplete');
  if (!run.cases.length) throw new Error('benchmark must contain cases');
  run.cases.forEach(validateBenchmarkCase);
  const modes = new Set(run.cases.map((result) => result.mode));
  for (const mode of BENCHMARK_MODES) if (!modes.has(mode)) throw new Error(`benchmark mode missing: ${mode}`);
  if (run.evidence === 'live-codex' && run.cases.some((result) => result.captureStatus === 'uncaptured')) throw new Error('live Codex benchmark contains uncaptured cases');
}

export function summarizeBenchmark(run: ControlledBenchmarkRun): Readonly<Record<BenchmarkMode, { cases: number; answerScore: number; citationPrecision: number; unsupportedClaimRate: number; p50LatencyMs: number }>> {
  validateControlledBenchmark(run);
  return Object.fromEntries(BENCHMARK_MODES.map((mode) => {
    const cases = run.cases.filter((result) => result.mode === mode);
    const median = [...cases].map((result) => result.latencyMs).sort((a, b) => a - b)[Math.floor(cases.length / 2)] ?? 0;
    return [mode, { cases: cases.length, answerScore: cases.reduce((sum, result) => sum + result.answerScore, 0) / cases.length, citationPrecision: cases.reduce((sum, result) => sum + result.citationPrecision, 0) / cases.length, unsupportedClaimRate: cases.reduce((sum, result) => sum + result.unsupportedClaimRate, 0) / cases.length, p50LatencyMs: median }];
  })) as Readonly<Record<BenchmarkMode, { cases: number; answerScore: number; citationPrecision: number; unsupportedClaimRate: number; p50LatencyMs: number }>>;
}

export function benchmarkRunsMarkdown(projectId: string, runs: readonly ControlledBenchmarkRun[]): string {
  const lines = [`# Project benchmark export`, ``, `Project: ${projectId}`, `Runs: ${runs.length}`, ``];
  for (const run of runs) {
    lines.push(`## ${run.id}`, ``, `- Generated: ${run.generatedAt}`, `- Corpus: ${run.corpusId}`, `- Model: ${run.modelId}`, `- Evidence: ${run.evidence}`, ``, `| Mode | Cases | Answer | Citation | Unsupported | p50 latency |`, `|---|---:|---:|---:|---:|---:|`);
    const summary = summarizeBenchmark(run);
    for (const mode of BENCHMARK_MODES) { const item = summary[mode]; lines.push(`| ${mode} | ${item.cases} | ${(item.answerScore * 100).toFixed(1)}% | ${(item.citationPrecision * 100).toFixed(1)}% | ${(item.unsupportedClaimRate * 100).toFixed(1)}% | ${item.p50LatencyMs} ms |`); }
    lines.push(``);
  }
  return lines.join('\n');
}

export const sanitizeBenchmarkExportFilename = (projectId: string): string => `${projectId.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 96) || 'project'}-benchmark.md`;
