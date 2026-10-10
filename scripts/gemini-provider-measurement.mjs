import { writeFile } from 'node:fs/promises';
import { createGeminiExtractionProvider } from '../lib/runtime/providers/gemini.ts';
import { extractWithProvider } from '../lib/runtime/memory-extraction.ts';
import { normalizeCodexMcpEvent } from '../lib/runtime/codex-ingestion.ts';

const budgetUsd = Number(process.env.GEMINI_MAX_COST_USD ?? '1');
if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 1) throw new Error('GEMINI_MAX_COST_USD must be greater than 0 and no more than 1');
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

const scope = { tenantId: 'provider-evaluation-tenant', bankId: 'provider-evaluation-bank' };
const cases = [
  'Decision: we will use PostgreSQL for durable project memory.',
  'Requirement: exports must preserve immutable evidence provenance.',
  'Risk: concurrent review mutations could collide without atomic sequencing.',
  'Blocker: provider quality cannot be claimed without human review.',
  'Next step: validate temporal graph retrieval against source evidence.',
];
const events = cases.map((content, index) => normalizeCodexMcpEvent(scope, { projectId: 'provider-evaluation-project', conversationId: 'provider-evaluation-conversation', timestamp: '2026-10-10T00:00:00.000Z' }, { messageId: `provider-case-${index + 1}`, method: 'measurement', content }));
const result = await extractWithProvider(events, createGeminiExtractionProvider(), { timeoutMs: 20_000, maxCandidates: events.length, estimatedCostUsd: 0.01, maxCostUsd: budgetUsd });
const reviewed = result.candidates.map((candidate) => ({ sourceEventId: candidate.sourceEventId, type: candidate.record.type, accepted: candidate.record.source.platform === 'gemini' && candidate.record.evidence.some((evidence) => evidence.reference === candidate.sourceEventId), rationale: 'Automated reviewer: schema-valid proposal preserves its source-event evidence reference.' }));
const report = { version: 'gemini-provider-sample-v1', provider: result.provider, budgetUsd, sampleSize: events.length, mode: result.mode, latencyMs: result.latencyMs, estimatedCostUsd: result.telemetry.costUsd, accepted: result.telemetry.accepted, rejected: result.rejected, fallbackError: result.error, reviewer: 'Codex', reviewed, canonicalWrites: 0, generatedAt: new Date().toISOString() };
await writeFile(new URL('../docs/benchmarks/gemini-provider-measurement.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ provider: report.provider, mode: report.mode, sampleSize: report.sampleSize, accepted: report.accepted, rejected: report.rejected, latencyMs: report.latencyMs, estimatedCostUsd: report.estimatedCostUsd, canonicalWrites: report.canonicalWrites, fallbackError: report.fallbackError }));
