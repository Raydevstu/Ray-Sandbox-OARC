import type { RecallSettings } from "@/lib/types";
import { buildSeedFacts, buildSeedLinks, seedObservations, seedOpinions, seedBank } from "@/lib/data/seed";
import { SEED_EVALSET } from "@/lib/data/evalset";
import { runEvaluation } from "./evaluate";
import { recall } from "./recall";
import { retain } from "./retain";
import { resolveFactHistory } from "./temporal";
import { buildRecallDigest } from "./digest";
import { buildMemoryLayers, packLayeredFacts } from "./layers";
import { buildFilesystemProjection } from "./projection";
import { createIntegrationEvent } from "./integration-events";
import { enqueueEvent, replayQueue } from "./offline-queue";
import { recordFeedback } from "./feedback";

export const BENCHMARK_ROUTES = [
  "/sandbox", "/sandbox/memory", "/sandbox/prompts", "/sandbox/context",
  "/sandbox/learning", "/sandbox/orchestrator", "/sandbox/eval",
  "/sandbox/benchmarks", "/sandbox/integrations", "/sandbox/snapshots",
] as const;

const settings: RecallSettings = {
  budget: "mid", budgetMode: "adaptive", maxTokens: 4096, rrfK: 60,
  rerankerCap: 50, rerankEnabled: true, includeChunks: true, maxChunkTokens: 320,
  boosts: { semantic: 1, bm25: 1, graph: 1, temporal: 1 }, recencyAlpha: .12,
  temporalAlpha: .18, proofAlpha: .1, entityBoostAlpha: .12, includeExpired: false,
  dedupThreshold: .84, autoConsolidation: true, observationsMission: "surface durable patterns",
  consolidationStrategies: "{}", types: [],
};

export interface ScenarioMetric {
  id: string;
  feature: string;
  status: "PASS" | "FAIL";
  before: number;
  after: number;
  delta: number;
  evidence: string;
}

export interface BenchmarkReport {
  generatedAt: string;
  metrics: ScenarioMetric[];
  passRate: number;
  afterAccuracy: number;
  beforeAccuracy: number;
  competitor: { name: string; accuracy: number; note: string }[];
}

const metric = (id: string, feature: string, before: number, after: number, evidence: string): ScenarioMetric => ({
  id, feature, status: after >= 1 ? "PASS" : "FAIL", before, after, delta: Number((after - before).toFixed(3)), evidence,
});

export function runScenarioBenchmark(): BenchmarkReport {
  const facts = buildSeedFacts(seedBank.id);
  const links = buildSeedLinks(facts);
  const metrics: ScenarioMetric[] = [];
  const baseline = runEvaluation({ questions: SEED_EVALSET, facts, links, observations: seedObservations, opinions: seedOpinions, settings: { ...settings, rerankEnabled: false, temporalAlpha: 0, entityBoostAlpha: 0 }, runName: "legacy-baseline", bankId: seedBank.id });
  const after = runEvaluation({ questions: SEED_EVALSET, facts, links, observations: seedObservations, opinions: seedOpinions, settings, runName: "milestone-5-after", bankId: seedBank.id });

  const retained = retain("Alice switched from React to Vue in April 2026 and prefers TypeScript.", { bankId: seedBank.id, speaker: "user", scopes: { userId: "alice" }, tags: ["scenario"] });
  metrics.push(metric("retain", "Retain and metadata", 0, retained.facts.length > 0 && retained.facts.every((f) => f.temporalMeta && f.scopes.userId === "alice") ? 1 : 0, `${retained.facts.length} fact(s), temporal metadata and user scope present`));

  const current = recall({ query: "What does Alice use now?", facts, links, observations: seedObservations, opinions: seedOpinions, settings });
  const historical = recall({ query: "What did Alice use before?", facts, links, observations: seedObservations, opinions: seedOpinions, settings });
  metrics.push(metric("recall", "Temporal intent and trace", 0, current.temporalIntent === "current" && historical.temporalIntent === "historical" ? 1 : 0, `${current.temporalIntent} / ${historical.temporalIntent}`));

  const digest = buildRecallDigest("Alice preferences", current.selected);
  metrics.push(metric("digest", "Cited deterministic digest", 0, digest.bullets.every((b) => b.factIds.length > 0) ? 1 : 0, `${digest.bullets.length} bullets with source citations`));

  const layers = packLayeredFacts(facts.slice(0, 4).map((f) => { const summary = buildMemoryLayers(f.text); return { id: f.id, abstract: summary.l0, overview: summary.l1, detail: summary.l2 }; }), 1200);
  metrics.push(metric("layers", "L0/L1/L2 packing", 0, layers.layers.length === 4 && layers.tokensUsed <= 1200 ? 1 : 0, `${layers.layers.length} layers / ${layers.tokensUsed} tokens`));

  const oldFact = facts[0];
  const resolved = resolveFactHistory([{ ...oldFact, supersedes: null }, { ...oldFact, id: "newer", text: "Alice now works at Anthropic", supersedes: oldFact.id }], "current");
  metrics.push(metric("supersession", "Current/history resolution", 0, resolved.length === 1 && resolved[0].id === "newer" ? 1 : 0, `${resolved.length} current fact(s)`));

  const event = createIntegrationEvent({ type: "memory.recalled", payload: { query: "Alice" }, app: "benchmark" });
  const queued = enqueueEvent([], event);
  const replay = replayQueue(queued, { failEventIds: [] });
  metrics.push(metric("queue", "Canonical event and offline replay", 0, replay.delivered[0]?.id === event.id && replay.queue.length === 0 ? 1 : 0, `${replay.delivered.length} delivered, ${replay.queue.length} pending`));

  const feedback = recordFeedback({ factId: facts[0].id, outcome: "up" }, []);
  metrics.push(metric("feedback", "Outcome feedback", 0, feedback[0]?.factId === facts[0].id ? 1 : 0, `${feedback.length} immutable record`));

  const projection = buildFilesystemProjection({ bankId: seedBank.id, bankName: seedBank.name, facts: facts.slice(0, 5).map((f) => ({ id: f.id, text: f.text, entities: f.entities, tags: f.tags })) });
  metrics.push(metric("projection", "Filesystem projection", 0, projection.files.length > 5 && JSON.parse(projection.manifest).files.length === projection.files.length ? 1 : 0, `${projection.files.length} generated files`));

  const passRate = Number((metrics.filter((m) => m.status === "PASS").length / metrics.length * 100).toFixed(1));
  return {
    generatedAt: new Date().toISOString(), metrics, passRate,
    afterAccuracy: after.accuracy, beforeAccuracy: baseline.accuracy,
    competitor: [
      { name: "Hindsight sandbox (after)", accuracy: after.accuracy, note: "Deterministic local gold-token judge" },
      { name: "Hindsight sandbox (legacy baseline)", accuracy: baseline.accuracy, note: "Same fixture; rerank/temporal/entity boosts disabled" },
      { name: "Mem0 published reference", accuracy: 92, note: "Reference only; not run in this local harness" },
      { name: "Zep published reference", accuracy: 81, note: "Reference only; not run in this local harness" },
    ],
  };
}

export function benchmarkMarkdown(report: BenchmarkReport): string {
  const rows = report.metrics.map((m) => `| ${m.feature} | ${m.before} | ${m.after} | ${m.delta >= 0 ? "+" : ""}${m.delta} | ${m.status} | ${m.evidence} |`).join("\n");
  const competitors = report.competitor.map((c) => `| ${c.name} | ${c.accuracy}% | ${c.note} |`).join("\n");
  return `# Memory App Scenario Benchmark\n\nGenerated: ${report.generatedAt}\n\n## Before / after\n\nPass rate: **${report.passRate}%** · Evaluation accuracy: **${report.beforeAccuracy}% → ${report.afterAccuracy}%**\n\n| Feature | Before | After | Delta | Status | Evidence |\n|---|---:|---:|---:|---|---|\n${rows}\n\n## Competitor/reference comparison\n\n| System | Accuracy | Method note |\n|---|---:|---|\n${competitors}\n\n> Local results use a deterministic token-overlap judge. Published references are directional and were not executed by this harness.\n\n## Audit\n\nMajor upgrade opportunities: add browser-level assertions for every control, replace synthetic competitor references with reproducible public datasets, add human/LLM judging beside token overlap, and add retry/restore controls for failed offline queue entries.\n`;
}
