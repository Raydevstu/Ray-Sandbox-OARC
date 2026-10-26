import { stableId } from './contracts';
import type { ConversationEvent, EvidenceKind, ProjectEvent, ProjectMemoryRecord, ProjectMemoryType } from './contracts';
import { ProjectMemoryRecordSchema } from './schemas';

export type ExtractionCandidate = Readonly<{ record: ProjectMemoryRecord; sourceEventId: string; rule: string }>;
export type ExtractionMode = 'provider' | 'deterministic-degraded';
export type ExtractionTelemetry = Readonly<{ provider: string; accepted: number; rejected: number; latencyMs: number; costUsd: number }>;
export type ExtractionResult = Readonly<{ mode: ExtractionMode; candidates: readonly ExtractionCandidate[]; provider?: string; rejected: number; latencyMs: number; error?: string; telemetry: ExtractionTelemetry }>;
export interface MemoryExtractionProvider { readonly name: string; extract(events: readonly ProjectEvent[]): Promise<readonly ExtractionCandidate[]>; }
export type ExtractionOptions = Readonly<{ timeoutMs?: number; maxCandidates?: number; estimatedCostUsd?: number; maxCostUsd?: number }>;

const textOf = (event: ProjectEvent): string => {
  const conversation = event.payload.conversation as ConversationEvent | undefined;
  if (conversation) return conversation.content;
  const evidence = event.payload.evidence as Record<string, unknown> | undefined;
  return evidence ? JSON.stringify(evidence) : JSON.stringify(event.payload);
};
const sourceFor = (event: ProjectEvent, kind: EvidenceKind, reference: string) => ({ kind, reference, observedAt: event.occurredAt });
const evidenceKindFor = (event: ProjectEvent): EvidenceKind => event.type === 'EvidenceTest' ? 'test' : event.type === 'EvidenceBuild' ? 'runtime' : event.type === 'EvidenceRuntimeHealth' ? 'http' : event.type === 'EvidenceBrowser' ? 'browser' : event.type === 'EvidenceRepository' ? 'commit' : 'conversation';
const titleFor = (type: ProjectMemoryType, text: string): string => `${type[0].toUpperCase()}${type.slice(1).replace('_', ' ')}: ${text.trim().replace(/\s+/g, ' ').slice(0, 80)}`;

type Rule = Readonly<{ name: string; type: ProjectMemoryType; pattern: RegExp; status: ProjectMemoryRecord['status']; importance: ProjectMemoryRecord['importance']; confidence: number }>;
const rules: readonly Rule[] = [
  { name: 'explicit-decision', type: 'decision', pattern: /\b(decide|decision|we will|use|adopt|chosen|agreed)\b/i, status: 'active', importance: 'high', confidence: 0.8 },
  { name: 'requirement', type: 'requirement', pattern: /\b(must|required|requirement|needs to|should support)\b/i, status: 'pending', importance: 'high', confidence: 0.75 },
  { name: 'risk', type: 'risk', pattern: /\b(risk|danger|could fail|may break|regression)\b/i, status: 'active', importance: 'normal', confidence: 0.7 },
  { name: 'blocker', type: 'blocker', pattern: /\b(blocked|blocker|cannot proceed|unable to|refused|unavailable)\b/i, status: 'blocked', importance: 'high', confidence: 0.8 },
  { name: 'follow-up', type: 'follow_up', pattern: /\b(next step|follow[- ]?up|todo|to do|pending)\b/i, status: 'pending', importance: 'normal', confidence: 0.7 },
];
const evidenceRule = (event: ProjectEvent): Rule | undefined => {
  const evidence = event.payload.evidence as Record<string, unknown> | undefined;
  if (event.type === 'EvidenceTest') return { name: 'test-evidence', type: 'test', pattern: /.*/, status: evidence?.status === 'passed' ? 'verified' : evidence?.status === 'failed' ? 'blocked' : 'pending', importance: evidence?.status === 'failed' ? 'high' : 'normal', confidence: 0.95 };
  if (event.type === 'EvidenceBuild') return { name: 'build-evidence', type: 'implementation', pattern: /.*/, status: evidence?.status === 'passed' ? 'verified' : 'blocked', importance: evidence?.status === 'failed' ? 'high' : 'normal', confidence: 0.95 };
  if (event.type === 'EvidenceRuntimeHealth') return { name: 'runtime-evidence', type: 'runtime', pattern: /.*/, status: evidence?.healthy === true ? 'verified' : 'blocked', importance: 'high', confidence: 0.95 };
  if (event.type === 'EvidenceBrowser') return { name: 'browser-evidence', type: 'test', pattern: /.*/, status: typeof evidence?.status === 'number' && evidence.status >= 200 && evidence.status < 400 ? 'verified' : 'blocked', importance: 'normal', confidence: 0.9 };
  return undefined;
};

export const extractProjectMemoryCandidates = (events: readonly ProjectEvent[]): readonly ExtractionCandidate[] => events.flatMap((event) => {
  const text = textOf(event);
  const rule = evidenceRule(event) ?? rules.find((candidate) => candidate.pattern.test(text));
  if (!rule) return [];
  const conversation = event.payload.conversation as ConversationEvent | undefined;
  const sourceReference = String(event.payload.sourceReference ?? conversation?.messageId ?? event.id);
  const record: ProjectMemoryRecord = { tenantId: event.tenantId, bankId: event.bankId, id: stableId('candidate', event.id, rule.name), projectId: event.projectId, type: rule.type, title: titleFor(rule.type, text), content: text, status: rule.status, confidence: rule.confidence, importance: rule.importance, source: { platform: conversation?.platform ?? String(event.payload.source ?? 'runtime'), conversationId: conversation?.conversationId, messageId: conversation?.messageId, timestamp: event.occurredAt }, evidence: [sourceFor(event, evidenceKindFor(event), sourceReference)], supersedes: [], relatedRecords: [], createdAt: event.occurredAt, updatedAt: event.occurredAt };
  return [{ record, sourceEventId: event.id, rule: rule.name }];
});

/** Provider boundary. The deterministic extractor remains an explicit degraded fallback. */
export const extractWithProvider = async (events: readonly ProjectEvent[], provider?: MemoryExtractionProvider, options: ExtractionOptions = {}): Promise<ExtractionResult> => {
  const startedAt = Date.now();
  const fallback = (error: string, providerName = 'deterministic'): ExtractionResult => { const candidates = extractProjectMemoryCandidates(events); const latencyMs = Date.now() - startedAt; return { mode: 'deterministic-degraded', candidates, provider: providerName, rejected: 0, latencyMs, error, telemetry: { provider: providerName, accepted: candidates.length, rejected: 0, latencyMs, costUsd: 0 } }; };
  if (!provider) return fallback('no extraction provider configured');
  try {
    const timeoutMs = Math.max(1, options.timeoutMs ?? 10_000);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('provider extraction timed out')), timeoutMs));
    const candidates = await Promise.race([provider.extract(events), timeout]);
    const accepted = candidates.filter((candidate) => ProjectMemoryRecordSchema.safeParse(candidate.record).success).slice(0, Math.max(1, options.maxCandidates ?? candidates.length));
    const rejected = candidates.length - accepted.length;
    const costUsd = options.estimatedCostUsd ?? 0;
    const latencyMs = Date.now() - startedAt;
    const telemetry = { provider: provider.name, accepted: accepted.length, rejected, latencyMs, costUsd };
    if (options.maxCostUsd !== undefined && costUsd > options.maxCostUsd) return { ...fallback('provider cost budget exceeded', provider.name), rejected, telemetry };
    return { mode: 'provider', provider: provider.name, candidates: accepted, rejected, latencyMs, telemetry };
  } catch (error) {
    return fallback(error instanceof Error ? error.message : 'provider extraction failed', provider.name);
  }
};
