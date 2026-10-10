import { stableId } from './contracts';
import type { ProjectMemoryRecord } from './contracts';
import type { ExtractionCandidate } from './memory-extraction';
import type { MemoryPolicy } from './memory-policy';

export type GovernanceAction = Readonly<{ kind: 'created' | 'deduplicated' | 'superseded' | 'conflict' | 'invalidated'; recordId: string; relatedRecordIds: readonly string[]; reason: string }>;
export type GovernanceResult = Readonly<{ records: readonly ProjectMemoryRecord[]; actions: readonly GovernanceAction[] }>;
export type InvalidationSignal = Readonly<{ reference: string; reason: string; observedAt: string }>;
export type ExtractionRouting = Readonly<{ approved: readonly ExtractionCandidate[]; review: readonly ExtractionCandidate[]; rejected: readonly ExtractionCandidate[] }>;
export type GovernedProviderResult = GovernanceResult & Readonly<{ routing: ExtractionRouting }>;

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');
const identity = (record: Pick<ProjectMemoryRecord, 'projectId' | 'type' | 'title'>): string => stableId('memory-identity', record.projectId, record.type, normalize(record.title));
const contentKey = (record: Pick<ProjectMemoryRecord, 'projectId' | 'type' | 'content'>): string => stableId('memory-content', record.projectId, record.type, normalize(record.content));
const withEvidence = (record: ProjectMemoryRecord, candidate: ProjectMemoryRecord): ProjectMemoryRecord => ({ ...record, evidence: [...record.evidence, ...candidate.evidence.filter((evidence) => !record.evidence.some((current) => current.kind === evidence.kind && current.reference === evidence.reference))], confidence: Math.max(record.confidence, candidate.confidence), updatedAt: candidate.updatedAt });

export const routeExtractionCandidates = (candidates: readonly ExtractionCandidate[], policy: MemoryPolicy): ExtractionRouting => {
  const approved: ExtractionCandidate[] = [];
  const review: ExtractionCandidate[] = [];
  const rejected: ExtractionCandidate[] = [];
  for (const candidate of candidates) {
    const record = candidate.record;
    if (!record.evidence.length || record.confidence < policy.minimumConfidence) review.push(candidate);
    else if (policy.approvalRequiredFor.includes(record.type) || policy.approvalRequiredFor.includes(record.importance)) review.push(candidate);
    else if (!policy.connectorAllowlist.includes(record.source.platform)) rejected.push(candidate);
    else approved.push(candidate);
  }
  return { approved, review, rejected };
};

export const governProviderCandidates = (existing: readonly ProjectMemoryRecord[], candidates: readonly ExtractionCandidate[], policy: MemoryPolicy): GovernedProviderResult => {
  const routing = routeExtractionCandidates(candidates, policy);
  return { ...governCandidates(existing, routing.approved), routing };
};

export const governCandidates = (existing: readonly ProjectMemoryRecord[], candidates: readonly ExtractionCandidate[]): GovernanceResult => {
  const records = [...existing];
  const actions: GovernanceAction[] = [];
  for (const candidate of candidates) {
    const incoming = candidate.record;
    if (!incoming.source.platform || !incoming.source.timestamp || !incoming.evidence.length) throw new Error('canonical memory requires provenance');
    const duplicate = records.find((record) => contentKey(record) === contentKey(incoming));
    if (duplicate) { const index = records.indexOf(duplicate); records[index] = withEvidence(duplicate, incoming); actions.push({ kind: 'deduplicated', recordId: duplicate.id, relatedRecordIds: [incoming.id], reason: 'same normalized project memory content' }); continue; }
    const sameIdentity = records.filter((record) => identity(record) === identity(incoming) && record.status !== 'superseded');
    const explicitSupersedes = incoming.supersedes.filter((id) => records.some((record) => record.id === id));
    if (explicitSupersedes.length) for (const id of explicitSupersedes) { const index = records.findIndex((record) => record.id === id); records[index] = { ...records[index], status: 'superseded', updatedAt: incoming.updatedAt }; actions.push({ kind: 'superseded', recordId: id, relatedRecordIds: [incoming.id], reason: 'explicit supersession' }); }
    if (sameIdentity.length && !explicitSupersedes.length && sameIdentity.some((record) => normalize(record.content) !== normalize(incoming.content))) { const conflicted = sameIdentity.map((record) => record.id); for (const id of conflicted) { const index = records.findIndex((record) => record.id === id); records[index] = { ...records[index], status: 'conflict', updatedAt: incoming.updatedAt }; } records.push({ ...incoming, status: 'conflict', relatedRecords: [...new Set([...incoming.relatedRecords, ...conflicted])] }); actions.push({ kind: 'conflict', recordId: incoming.id, relatedRecordIds: conflicted, reason: 'same memory identity with contradictory content' }); continue; }
    records.push({ ...incoming, supersedes: explicitSupersedes });
    actions.push({ kind: 'created', recordId: incoming.id, relatedRecordIds: explicitSupersedes, reason: 'new provenance-linked canonical record' });
  }
  return { records, actions };
};

export const invalidateByEvidence = (records: readonly ProjectMemoryRecord[], signals: readonly InvalidationSignal[]): GovernanceResult => {
  const actions: GovernanceAction[] = [];
  const next = records.map((record) => {
    const matched = signals.filter((signal) => record.evidence.some((evidence) => evidence.reference === signal.reference));
    if (!matched.length || record.status === 'superseded') return record;
    actions.push({ kind: 'invalidated', recordId: record.id, relatedRecordIds: [], reason: matched.map((signal) => signal.reason).join('; ') });
    return { ...record, status: 'stale' as const, updatedAt: matched.map((signal) => signal.observedAt).sort().at(-1) ?? record.updatedAt };
  });
  return { records: next, actions };
};
