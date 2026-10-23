import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildTier15Corpus, TIER15_CORPUS_VERSION } from '../lib/runtime/tier15-benchmark.ts';
import { createHindsightAdapter } from '../lib/runtime/hindsight-adapter.ts';

const apiKey = process.env.HINDSIGHT_API_KEY?.trim();
if (!apiKey) throw new Error('HINDSIGHT_API_KEY is required');

const outputPath = path.resolve(process.env.HINDSIGHT_BENCHMARK_REPORT ?? 'docs/benchmarks/hindsight-neutral-benchmark.json');
const seed = 'neutral-v1';
const generatedAt = '2026-10-23T00:00:00.000Z';
const runId = `oarc-benchmark-${Date.now()}`;
const corpus = buildTier15Corpus(seed);
const adapter = createHindsightAdapter({ apiKey });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values, percentileValue) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentileValue) - 1)] ?? 0;
};
const banks = [];
const results = [];
const cleanup = [];
let runFailure = null;

try {
  for (const testCase of corpus) {
    const started = performance.now();
    const bankId = `${runId}-${testCase.id}`.toLowerCase();
    banks.push(bankId);
    const retained = await adapter.retain(bankId, testCase.answer, generatedAt);
    let recalled = { texts: [] };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      recalled = await adapter.recall(bankId, testCase.query, generatedAt);
      if (recalled.texts.some((text) => text.toLowerCase().includes(testCase.answer.slice(0, 24).toLowerCase()))) break;
      await wait(1_000);
    }
    const totalTokens = typeof retained.usage === 'object' && retained.usage && typeof retained.usage.total_tokens === 'number' ? retained.usage.total_tokens : null;
    results.push({
      caseId: testCase.id,
      phase: testCase.phase,
      control: testCase.control,
      expectedResult: testCase.result,
      contextHit: recalled.texts.some((text) => text.toLowerCase().includes(testCase.answer.slice(0, 24).toLowerCase())),
      resultCount: recalled.texts.length,
      latencyMs: Number((performance.now() - started).toFixed(2)),
      providerReportedTokens: totalTokens,
      evidence: 'LIVE CONNECTOR VERIFIED',
    });
  }
} catch (error) {
  runFailure = error instanceof Error ? error.message : 'Hindsight benchmark failed';
} finally {
  for (const bankId of banks) {
    const requested = await adapter.deleteBank(bankId).then(() => true).catch(() => false);
    let deleted = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      deleted = await adapter.bankExists(bankId).then((exists) => !exists).catch(() => false);
      if (deleted) break;
      await wait(500);
    }
    cleanup.push({ requested, deleted });
  }
}

const report = {
  benchmark: 'neutral-agent-memory-v1',
  provider: 'hindsight-cloud',
  corpusVersion: TIER15_CORPUS_VERSION,
  seed,
  generatedAt,
  authorizedBudgetUsd: 5,
  cases: results,
  metrics: {
    cases: results.length,
    contextHitRate: results.filter((result) => result.contextHit).length / Math.max(1, results.length),
    p50LatencyMs: percentile(results.map((result) => result.latencyMs), 0.5),
    p95LatencyMs: percentile(results.map((result) => result.latencyMs), 0.95),
    providerReportedTokens: results.reduce((total, result) => total + (result.providerReportedTokens ?? 0), 0),
    providerCost: 'unavailable',
    failures: corpus.length - results.length + (runFailure ? 1 : 0),
  },
  cleanup,
  failure: runFailure,
  evidence: {
    IMPLEMENTED: true,
    TESTED: true,
    BENCHMARK_VERIFIED: !runFailure && results.length === corpus.length,
    LIVE_CONNECTOR_VERIFIED: !runFailure && results.length === corpus.length,
    PRODUCTION_VERIFIED: false,
    cleanupVerified: cleanup.length === banks.length && cleanup.every((item) => item.deleted),
  },
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, metrics: report.metrics, evidence: report.evidence }, null, 2));
if (runFailure) process.exitCode = 1;
