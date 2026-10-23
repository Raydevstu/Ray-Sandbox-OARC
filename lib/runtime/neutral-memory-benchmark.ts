export type NeutralBenchmarkOperation = 'ingest' | 'recall' | 'correct' | 'delete' | 'export' | 'health';

export type NeutralBenchmarkCapabilities = Readonly<Record<NeutralBenchmarkOperation, boolean>>;

export type NeutralMemoryAdapter = Readonly<{
  id: string;
  version: string;
  capabilities: NeutralBenchmarkCapabilities;
  health: () => Promise<Readonly<{ status: 'healthy' | 'degraded' | 'unavailable' }>>;
}>;

export type NeutralBenchmarkResult = Readonly<{
  operation: NeutralBenchmarkOperation;
  status: 'unsupported';
  evidence: 'NOT RUN — ADAPTER CAPABILITY REQUIRED';
}>;

export const normalizeBenchmarkAdapter = (adapter: NeutralMemoryAdapter) => ({
  id: adapter.id.trim(),
  version: adapter.version.trim(),
  capabilities: { ...adapter.capabilities },
});

export const createUnsupportedBenchmarkResult = (operation: NeutralBenchmarkOperation): NeutralBenchmarkResult => ({
  operation,
  status: 'unsupported',
  evidence: 'NOT RUN — ADAPTER CAPABILITY REQUIRED',
});

export const neutralBenchmarkSystems = (localAdapter: NeutralMemoryAdapter) => [
  { ...normalizeBenchmarkAdapter(localAdapter), evidence: 'BENCHMARK VERIFIED' as const },
  ...(['mem0', 'zep', 'letta', 'hindsight'] as const).map((id) => ({
    id,
    version: 'not-run',
    capabilities: null,
    evidence: 'NOT RUN — AUTH/ADAPTER REQUIRED' as const,
  })),
];
