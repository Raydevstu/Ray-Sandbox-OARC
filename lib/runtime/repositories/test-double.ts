import type { ContextConfig, EntitySummary, EventRecord, EvidenceRecord, MemoryFactRevision, MemoryScope, OutboxRecord, Phase3DomainRecord, ProjectEvent, ProjectMemoryRecord, PromptVersion, WorkflowRun } from '../contracts';
import type { CanonicalRepository, Job, Projection, Snapshot, MemoryPolicyRecord } from './interfaces';
import type { GraphConflictRecord, GraphEdge, GraphEntity } from '../typed-graph';
import type { ControlledBenchmarkRun } from '../benchmark-contract';
import type { EvaluationCorrectionProposal, EvaluationRun, ReplayComparison, WorkflowReplay } from '../evaluation-contract';

export class TestRepository implements CanonicalRepository {
  private readonly facts: MemoryFactRevision[] = [];
  private readonly events: EventRecord[] = [];
  private readonly projections: Projection[] = [];
  private readonly snapshots: Snapshot[] = [];
  private readonly evidence: EvidenceRecord[] = [];
  private readonly outbox: OutboxRecord[] = [];
  private readonly idempotency = new Map<string, EventRecord>();
  private readonly deleted = new Set<string>();
  private readonly projectEvents: ProjectEvent[] = [];
  private readonly projectMemory: ProjectMemoryRecord[] = [];
  private readonly benchmarkRuns: Array<{ projectId: string; run: ControlledBenchmarkRun }> = [];
  private readonly evaluationRuns: Array<{ projectId: string; run: EvaluationRun }> = [];
  private readonly replayComparisons: ReplayComparison[] = [];
  private readonly evaluationCorrections: EvaluationCorrectionProposal[] = [];
  private readonly workflowReplays: WorkflowReplay[] = [];
  private readonly workflowRuns = new Map<string, WorkflowRun>();
  private readonly memoryPolicies: MemoryPolicyRecord[] = [];
  private readonly promptVersions: PromptVersion[] = [];
  private readonly contextConfigs = new Map<string, ContextConfig>();
  private readonly phase3DomainRecords = new Map<string, Phase3DomainRecord>();
  private readonly graphEntities: GraphEntity[] = [];
  private readonly graphEdges: GraphEdge[] = [];
  private readonly graphConflicts: GraphConflictRecord[] = [];
  constructor(private readonly tenantId: string) {}
  async retainMemoryAtomic(evidence: EvidenceRecord, fact: MemoryFactRevision, event: EventRecord, outbox: OutboxRecord, workflow?: WorkflowRun) { this.check(evidence); this.check(fact); this.check(event); this.check(outbox); this.evidence.push({ ...evidence }); this.facts.push({ ...fact, evidenceIds: [...fact.evidenceIds] }); this.events.push({ ...event, payload: { ...event.payload } }); this.outbox.push({ ...outbox }); this.idempotency.set(outbox.idempotencyKey, { ...event, payload: { ...event.payload } }); if (workflow) this.workflowRuns.set(workflow.workflowRunId, { ...workflow, completedSteps: [...workflow.completedSteps] }); }
  async correctMemoryAtomic(revision: MemoryFactRevision, event: EventRecord, outbox: OutboxRecord, workflow?: WorkflowRun) { this.check(revision); this.check(event); this.check(outbox); this.facts.push({ ...revision, evidenceIds: [...revision.evidenceIds] }); this.events.push({ ...event, payload: { ...event.payload } }); this.outbox.push({ ...outbox }); this.idempotency.set(outbox.idempotencyKey, { ...event, payload: { ...event.payload } }); if (workflow) this.workflowRuns.set(workflow.workflowRunId, { ...workflow, completedSteps: [...workflow.completedSteps] }); }
  private check(scope: MemoryScope) { if (scope.tenantId !== this.tenantId || !scope.bankId) throw new Error('scope denied'); }
  async appendEvidence(record: EvidenceRecord) { this.check(record); this.evidence.push({ ...record }); }
  async appendRevision(record: MemoryFactRevision) { this.check(record); this.facts.push({ ...record, evidenceIds: [...record.evidenceIds] }); }
  async findFacts(scope: MemoryScope & Readonly<{ projectId?: string }>) { this.check(scope); return this.facts.filter((fact) => fact.tenantId === scope.tenantId && fact.bankId === scope.bankId && (!scope.projectId || fact.projectId === scope.projectId) && !this.deleted.has(fact.id)).map((fact) => ({ ...fact, evidenceIds: [...fact.evidenceIds] })); }
  async searchFacts(scope: MemoryScope & Readonly<{ projectId?: string }>, queryTerms: readonly string[], limit: number) { const facts = await this.findFacts(scope); return facts.filter((fact) => queryTerms.some((term) => fact.claim.toLowerCase().includes(term.toLowerCase()))).slice(0, Math.max(1, limit)); }
  async tombstoneFact(scope: MemoryScope, factId: string, _deletedAt: string) { this.check(scope); this.deleted.add(factId); }
  async listEntities(scope: MemoryScope, _limit: number): Promise<readonly EntitySummary[]> { this.check(scope); return []; }
  async appendEvent(record: EventRecord) { this.check(record); this.events.push({ ...record, payload: { ...record.payload } }); this.idempotency.set(record.id, { ...record, payload: { ...record.payload } }); }
  async appendOutbox(record: OutboxRecord) { this.check(record); this.outbox.push({ ...record }); const event = this.events.find((candidate) => candidate.id === record.eventId); if (event) this.idempotency.set(record.idempotencyKey, { ...event, payload: { ...event.payload } }); }
  async claimJobs(scope: MemoryScope, _limit: number): Promise<readonly Job[]> { this.check(scope); return []; }
  async saveProjection(projection: Projection) { this.check(projection); this.projections.push({ ...projection, value: { ...projection.value } }); }
  async getByIdempotencyKey(scope: MemoryScope, key: string) { this.check(scope); return this.idempotency.get(key); }
  async writeSnapshot(snapshot: Snapshot) { this.check(snapshot); this.snapshots.push({ ...snapshot }); }
  async appendProjectEvent(event: ProjectEvent) { this.check(event); this.projectEvents.push({ ...event, payload: { ...event.payload } }); }
  async appendProjectEventNextSequence(event: ProjectEvent) { this.check(event); const sequence = Math.max(0, ...this.projectEvents.filter((candidate) => candidate.projectId === event.projectId).map((candidate) => candidate.sequence)) + 1; const persisted = { ...event, sequence }; this.projectEvents.push({ ...persisted, payload: { ...persisted.payload } }); return persisted; }
  async listProjectEvents(scope: MemoryScope, projectId: string) { this.check(scope); return this.projectEvents.filter((event) => event.projectId === projectId).sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id)); }
  async listProjectMemory(scope: MemoryScope, projectId: string) { this.check(scope); return this.projectMemory.filter((record) => record.projectId === projectId).map((record) => ({ ...record, evidence: [...record.evidence], supersedes: [...record.supersedes], relatedRecords: [...record.relatedRecords] })); }
  async appendProjectMemory(record: ProjectMemoryRecord) { this.check(record); this.projectMemory.push(record); }
  async upsertProjectMemory(record: ProjectMemoryRecord) { this.check(record); const index = this.projectMemory.findIndex((current) => current.tenantId === record.tenantId && current.bankId === record.bankId && current.id === record.id); if (index === -1) this.projectMemory.push(record); else this.projectMemory[index] = record; }
  async deleteProjectMemory(scope: MemoryScope, projectId: string, recordId: string, _deletedAt: string) { this.check(scope); const index = this.projectMemory.findIndex((record) => record.tenantId === scope.tenantId && record.bankId === scope.bankId && record.projectId === projectId && record.id === recordId); if (index >= 0) this.projectMemory.splice(index, 1); }
  async enqueueProjectJob(_job: import('../jobs/queue').JobRecord) { /* durable behavior is covered by the Postgres adapter */ }
  async saveProjectCheckpoint(_checkpoint: import('../jobs/checkpoints').Checkpoint) { /* test-double checkpoint is intentionally process-local */ }
  async getProjectCheckpoint(_scope: MemoryScope, _consumer: string) { return undefined; }
  async claimProjectJobs(_scope: MemoryScope, _consumer: string, _limit: number, _leaseMs: number) { return []; }
  async completeProjectJob(_scope: MemoryScope, _jobId: string, _consumer: string) { /* durable behavior is covered by the Postgres adapter */ }
  async failProjectJob(_scope: MemoryScope, _jobId: string, _consumer: string, _error: string, _maxAttempts: number, _retryAt: string) { return 'dead-letter' as const; }
  async replayDeadLetterJob(_scope: MemoryScope, _jobId: string, _availableAt: string) { return false; }
  async getProjectJobHealth(_scope: MemoryScope) { return { pending: 0, running: 0, complete: 0, deadLetter: 0, oldestPendingAt: null, lastError: null }; }
  async saveBenchmarkRun(scope: MemoryScope, projectId: string, run: ControlledBenchmarkRun) { this.check(scope); const index = this.benchmarkRuns.findIndex((item) => item.projectId === projectId && item.run.id === run.id); if (index === -1) this.benchmarkRuns.push({ projectId, run }); else this.benchmarkRuns[index] = { projectId, run }; }
  async listBenchmarkRuns(scope: MemoryScope, projectId: string, limit: number) { this.check(scope); return this.benchmarkRuns.filter((item) => item.projectId === projectId).sort((a, b) => b.run.generatedAt.localeCompare(a.run.generatedAt)).slice(0, limit).map((item) => item.run); }
  async saveEvaluationRun(scope: MemoryScope, projectId: string, run: EvaluationRun) { this.check(scope); const index = this.evaluationRuns.findIndex((item) => item.projectId === projectId && item.run.id === run.id); if (index === -1) this.evaluationRuns.push({ projectId, run }); else this.evaluationRuns[index] = { projectId, run }; }
  async saveEvaluationAtomic(scope: MemoryScope, projectId: string, run: EvaluationRun, event: EventRecord, outbox: OutboxRecord, workflow?: WorkflowRun) { this.check(scope); this.check(event); this.check(outbox); if (run.projectId !== projectId) throw new Error('evaluation project scope mismatch'); if (this.idempotency.has(outbox.idempotencyKey)) return; await this.saveEvaluationRun(scope, projectId, run); this.events.push({ ...event, payload: { ...event.payload } }); this.outbox.push({ ...outbox }); this.idempotency.set(outbox.idempotencyKey, { ...event, payload: { ...event.payload } }); if (workflow) this.workflowRuns.set(workflow.workflowRunId, { ...workflow, completedSteps: [...workflow.completedSteps] }); }
  async listEvaluationRuns(scope: MemoryScope, projectId: string, limit: number) { this.check(scope); return this.evaluationRuns.filter((item) => item.projectId === projectId).sort((a, b) => b.run.generatedAt.localeCompare(a.run.generatedAt)).slice(0, limit).map((item) => item.run); }
  async saveReplayComparison(scope: MemoryScope, comparison: ReplayComparison) { this.check(scope); const index = this.replayComparisons.findIndex((item) => item.id === comparison.id); if (index === -1) this.replayComparisons.push(comparison); else this.replayComparisons[index] = comparison; }
  async listReplayComparisons(scope: MemoryScope, projectId: string, limit: number) { this.check(scope); return this.replayComparisons.filter((item) => item.projectId === projectId).slice(0, limit); }
  async saveEvaluationCorrection(scope: MemoryScope, proposal: EvaluationCorrectionProposal) { this.check(scope); const index = this.evaluationCorrections.findIndex((item) => item.id === proposal.id); if (index === -1) this.evaluationCorrections.push(proposal); else this.evaluationCorrections[index] = proposal; }
  async listEvaluationCorrections(scope: MemoryScope, projectId: string, limit: number) { this.check(scope); return this.evaluationCorrections.filter((item) => item.projectId === projectId).slice(0, limit); }
  async saveWorkflowReplay(scope: MemoryScope, replay: WorkflowReplay) { this.check(scope); const index = this.workflowReplays.findIndex((item) => item.id === replay.id); if (index === -1) this.workflowReplays.push(replay); else this.workflowReplays[index] = replay; }
  async saveEvaluationBundleAtomic(scope: MemoryScope, projectId: string, baseline: EvaluationRun, replay: EvaluationRun, proposal: EvaluationCorrectionProposal, comparison: ReplayComparison, workflow: WorkflowReplay, run: WorkflowRun) { this.check(scope); this.saveEvaluationRun(scope, projectId, baseline); this.saveEvaluationRun(scope, projectId, replay); this.saveEvaluationCorrection(scope, proposal); this.saveReplayComparison(scope, comparison); this.saveWorkflowReplay(scope, workflow); this.upsertWorkflowRun(run); }
  async listWorkflowReplays(scope: MemoryScope, projectId: string, limit: number) { this.check(scope); return this.workflowReplays.filter((item) => item.projectId === projectId).slice(0, limit); }
  async upsertWorkflowRun(run: WorkflowRun) { this.check(run); this.workflowRuns.set(run.workflowRunId, { ...run, completedSteps: [...run.completedSteps] }); }
  async getWorkflowRun(scope: MemoryScope, workflowRunId: string) { this.check(scope); return this.workflowRuns.get(workflowRunId); }
  async saveMemoryPolicy(record: MemoryPolicyRecord) { this.check(record); const index = this.memoryPolicies.findIndex((item) => item.projectId === record.projectId && item.policy.policyId === record.policy.policyId && item.policy.version === record.policy.version); if (index === -1) this.memoryPolicies.push(record); else this.memoryPolicies[index] = record; }
  async listMemoryPolicies(scope: MemoryScope, projectId: string, limit: number) { this.check(scope); return this.memoryPolicies.filter((item) => item.projectId === projectId).sort((a, b) => b.policy.version - a.policy.version).slice(0, limit); }
  async savePromptVersion(version: PromptVersion) { this.check(version); const index = this.promptVersions.findIndex((item) => item.projectId === version.projectId && item.promptId === version.promptId && item.version === version.version); if (index === -1) this.promptVersions.push(version); else this.promptVersions[index] = version; }
  async listPromptVersions(scope: MemoryScope, projectId: string, promptId: string, limit: number) { this.check(scope); return this.promptVersions.filter((item) => item.tenantId === scope.tenantId && item.bankId === scope.bankId && item.projectId === projectId && item.promptId === promptId).sort((a, b) => b.version - a.version).slice(0, limit); }
  async saveContextConfig(config: ContextConfig) { this.check(config); const key = `${config.projectId}:${config.configId}`; const current = this.contextConfigs.get(key); if (!config.projectId || config.version < 1 || Object.keys(config.settings).length === 0) throw new Error('invalid context config'); if (current && config.version <= current.version) throw new Error('stale context config'); this.contextConfigs.set(key, { ...config, settings: { ...config.settings } }); }
  async getContextConfig(scope: MemoryScope, projectId: string, configId: string) { this.check(scope); const config = this.contextConfigs.get(`${projectId}:${configId}`); return config ? { ...config, settings: { ...config.settings } } : undefined; }
  async savePhase3DomainRecord(record: Phase3DomainRecord) { this.check(record); this.phase3DomainRecords.set(`${record.projectId}:${record.kind}:${record.recordId}`, { ...record, payload: { ...record.payload } }); }
  async listPhase3DomainRecords(scope: MemoryScope, projectId: string, kind: Phase3DomainRecord['kind'], limit: number) { this.check(scope); return [...this.phase3DomainRecords.values()].filter((record) => record.projectId === projectId && record.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit); }
  async saveGraphEntity(scope: MemoryScope, entity: GraphEntity) { this.check(scope); const index = this.graphEntities.findIndex((item) => item.id === entity.id); if (index < 0) this.graphEntities.push({ ...entity, aliases: [...(entity.aliases ?? [])] }); else this.graphEntities[index] = { ...entity, aliases: [...(entity.aliases ?? this.graphEntities[index].aliases ?? [])] }; }
  async saveGraphAlias(scope: MemoryScope, entityId: string, alias: string) { this.check(scope); const entity = this.graphEntities.find((item) => item.id === entityId); if (!entity) throw new Error('entity not found'); if (!alias.trim()) throw new Error('alias required'); if (!entity.aliases?.includes(alias)) this.graphEntities[this.graphEntities.indexOf(entity)] = { ...entity, aliases: [...(entity.aliases ?? []), alias] }; }
  async saveGraphEdge(scope: MemoryScope, edge: GraphEdge) { this.check(scope); if (edge.evidenceIds.length === 0) throw new Error('evidence required'); if (edge.validTo !== null && edge.validFrom > edge.validTo) throw new Error('validity range inverted'); const index = this.graphEdges.findIndex((item) => item.id === edge.id); if (index < 0) this.graphEdges.push({ ...edge, evidenceIds: [...edge.evidenceIds] }); else this.graphEdges[index] = { ...edge, evidenceIds: [...edge.evidenceIds] }; }
  async saveGraphConflict(scope: MemoryScope, conflict: GraphConflictRecord) { this.check(scope); const index = this.graphConflicts.findIndex((item) => item.key === conflict.key); if (index < 0) this.graphConflicts.push({ ...conflict, edgeIds: [...conflict.edgeIds] }); else this.graphConflicts[index] = { ...conflict, edgeIds: [...conflict.edgeIds] }; }
  async listGraph(scope: MemoryScope) { this.check(scope); return { entities: this.graphEntities.map((entity) => ({ ...entity, aliases: [...(entity.aliases ?? [])] })), edges: this.graphEdges.map((edge) => ({ ...edge, evidenceIds: [...edge.evidenceIds] })) }; }
  async listGraphConflicts(scope: MemoryScope) { this.check(scope); return this.graphConflicts.map((conflict) => ({ ...conflict, edgeIds: [...conflict.edgeIds] })); }
}
