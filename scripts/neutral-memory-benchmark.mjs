import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { produceTier15Benchmark, tier15Report } from '../lib/runtime/tier15-benchmark.ts';
import { neutralBenchmarkSystems } from '../lib/runtime/neutral-memory-benchmark.ts';

const outputPath = path.resolve(process.env.NEUTRAL_BENCHMARK_REPORT ?? 'docs/benchmarks/neutral-agent-memory-baseline.json');
const run = produceTier15Benchmark({ seed: process.env.NEUTRAL_BENCHMARK_SEED ?? 'neutral-v1', generatedAt: process.env.NEUTRAL_BENCHMARK_TIMESTAMP ?? '2026-10-23T00:00:00.000Z' });
const report = { benchmark: 'neutral-agent-memory-v1', adapter: { id: 'local-postgres-fixture', version: 'tier15-phase-1-3-5-v1' }, contract: { corpus: 'tier15-phase-1-3-5-v1', fixedSeed: run.seed, fixedTimestamp: run.generatedAt, replayHash: run.replayHash }, systems: neutralBenchmarkSystems({ id: 'local-postgres-fixture', version: 'tier15-phase-1-3-5-v1', capabilities: { ingest: true, recall: true, correct: true, delete: true, export: true, health: true }, async health() { return { status: 'healthy' }; } }), result: tier15Report(run), evidence: { IMPLEMENTED: true, TESTED: true, LOCALLY_VERIFIED: true, BENCHMARK_VERIFIED: true, LIVE_CONNECTOR_VERIFIED: false, PRODUCTION_VERIFIED: false } };
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, adapter: report.adapter, systems: report.systems.map(({ id, evidence }) => ({ id, evidence })), metrics: report.result.metrics }, null, 2));
