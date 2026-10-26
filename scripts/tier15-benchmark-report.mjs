import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { produceTier15Benchmark, tier15Report } from '../lib/runtime/tier15-benchmark.ts';

const seed = process.env.TIER15_SEED?.trim() || 'local';
const generatedAt = process.env.TIER15_GENERATED_AT?.trim() || '2026-10-23T00:00:00.000Z';
const report = tier15Report(produceTier15Benchmark({ seed, generatedAt }));
const outputPath = path.resolve('docs', 'benchmarks', 'tier15-phase-1-3-5-report.json');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, corpusVersion: report.corpusVersion, corpusHash: report.manifest.corpusHash, configHash: report.manifest.configHash, replayHash: report.replayHash, cases: report.metrics.cases, namespaceLeakageRate: report.metrics.namespaceLeakageRate, temporalLineageAccuracy: report.metrics.temporalLineageAccuracy, adversarialRejectionRate: report.metrics.adversarialRejectionRate, p50LatencyMs: report.metrics.p50LatencyMs, p95LatencyMs: report.metrics.p95LatencyMs, p99LatencyMs: report.metrics.p99LatencyMs, canonicalWrites: report.metrics.canonicalWrites, productionVerified: report.evidence.PRODUCTION_VERIFIED }, null, 2));
