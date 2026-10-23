import { stableId } from './contracts';
import type { MemoryScope, ProjectEvent } from './contracts';
import type { CanonicalRepository } from './repositories/interfaces';
import type { ProjectMemoryEnqueuer } from './project-memory-dispatch';
import { dispatchProjectMemory } from './project-memory-dispatch';

export type EvidenceConnectorMetadata = Readonly<{ projectId: string; source: string; observedAt: string }>;
export type RepositoryEvidence = Readonly<{ commit?: string; branch?: string; files?: readonly string[]; status?: string; message?: string }>;
export type TestEvidence = Readonly<{ command: string; status: 'passed' | 'failed' | 'skipped'; testFiles?: readonly string[]; output?: string }>;
export type BuildEvidence = Readonly<{ command: string; status: 'passed' | 'failed'; output?: string; artifact?: string }>;
export type RuntimeHealthEvidence = Readonly<{ endpoint: string; status: number; healthy: boolean; response?: string; checks?: Readonly<Record<string, boolean>> }>;
export type BrowserEvidence = Readonly<{ url: string; status: number; title?: string; viewport?: string; checks?: readonly string[]; screenshot?: string }>;

const requireMetadata = (metadata: EvidenceConnectorMetadata): EvidenceConnectorMetadata => {
  if (!metadata.projectId.trim() || !metadata.source.trim() || !metadata.observedAt) throw new Error('missing evidence connector metadata');
  return metadata;
};
const makeEvent = (scope: MemoryScope, metadata: EvidenceConnectorMetadata, kind: string, sourceReference: string, payload: Readonly<Record<string, unknown>>): ProjectEvent => ({ ...scope, id: stableId('evidence', scope.tenantId, scope.bankId, metadata.projectId, kind, sourceReference), projectId: metadata.projectId, type: `Evidence${kind}`, payload: { source: metadata.source, sourceReference, observedAt: metadata.observedAt, ...payload }, occurredAt: metadata.observedAt, sequence: 0 });

export const normalizeRepositoryEvidence = (scope: MemoryScope, metadata: EvidenceConnectorMetadata, evidence: RepositoryEvidence): ProjectEvent => { requireMetadata(metadata); const reference = evidence.commit ?? evidence.branch ?? metadata.source; return makeEvent(scope, metadata, 'Repository', reference, { evidence }); };
export const normalizeTestEvidence = (scope: MemoryScope, metadata: EvidenceConnectorMetadata, evidence: TestEvidence): ProjectEvent => { requireMetadata(metadata); if (!evidence.command.trim()) throw new Error('missing test command'); return makeEvent(scope, metadata, 'Test', evidence.command, { evidence }); };
export const normalizeBuildEvidence = (scope: MemoryScope, metadata: EvidenceConnectorMetadata, evidence: BuildEvidence): ProjectEvent => { requireMetadata(metadata); if (!evidence.command.trim()) throw new Error('missing build command'); return makeEvent(scope, metadata, 'Build', evidence.command, { evidence }); };
export const normalizeRuntimeHealthEvidence = (scope: MemoryScope, metadata: EvidenceConnectorMetadata, evidence: RuntimeHealthEvidence): ProjectEvent => { requireMetadata(metadata); if (!evidence.endpoint.trim()) throw new Error('missing runtime endpoint'); return makeEvent(scope, metadata, 'RuntimeHealth', evidence.endpoint, { evidence }); };
export const normalizeBrowserEvidence = (scope: MemoryScope, metadata: EvidenceConnectorMetadata, evidence: BrowserEvidence): ProjectEvent => { requireMetadata(metadata); if (!evidence.url.trim()) throw new Error('missing browser URL'); return makeEvent(scope, metadata, 'Browser', `${evidence.url}#${evidence.viewport ?? 'default'}`, { evidence }); };

export const persistEvidenceEvent = async (repository: CanonicalRepository, event: ProjectEvent, dispatcher?: ProjectMemoryEnqueuer): Promise<{ event: ProjectEvent; duplicate: boolean; queued: boolean }> => {
  const existing = await repository.listProjectEvents(event, event.projectId);
  const prior = existing.find((candidate) => candidate.id === event.id);
  if (prior) return { event: prior, duplicate: true, queued: false };
  const persisted = await repository.appendProjectEventNextSequence(event);
  return { event: persisted, duplicate: false, queued: dispatchProjectMemory(dispatcher, persisted) };
};
