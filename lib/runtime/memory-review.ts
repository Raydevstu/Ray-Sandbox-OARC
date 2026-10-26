import type { ProjectMemoryRecord, ProjectEvent } from './contracts';
import { stableId } from './contracts';

export type ReviewAction = 'approve-supersession' | 'mark-uncertain' | 'invalidate';
export type ReviewRequest = Readonly<{ action: ReviewAction; recordId: string; reviewer: string; reason: string; at: string }>;
export type ReviewResult = Readonly<{ record: ProjectMemoryRecord; event: ProjectEvent }>;

export function reviewProjectMemory(records: readonly ProjectMemoryRecord[], request: ReviewRequest): ReviewResult {
  if (!request.recordId.trim() || !request.reviewer.trim() || !request.reason.trim()) throw new Error('review requires record, reviewer, and reason');
  const current = records.find((record) => record.id === request.recordId);
  if (!current) throw new Error('memory record not found');
  if (current.status === 'superseded' && request.action === 'approve-supersession') throw new Error('record is already superseded');
  const status: ProjectMemoryRecord['status'] = request.action === 'approve-supersession' ? 'verified' : request.action === 'mark-uncertain' ? 'uncertain' : 'stale';
  const record: ProjectMemoryRecord = { ...current, status, updatedAt: request.at, evidence: [...current.evidence, { kind: 'decision', reference: `review:${request.reviewer}:${request.recordId}`, observedAt: request.at }] };
  const event: ProjectEvent = { tenantId: current.tenantId, bankId: current.bankId, id: stableId('memory-review', current.tenantId, current.bankId, current.projectId, current.id, request.action, request.at), projectId: current.projectId, type: 'ProjectMemoryReviewCompleted', payload: { action: request.action, recordId: current.id, reviewer: request.reviewer, reason: request.reason, fromStatus: current.status, toStatus: status }, occurredAt: request.at, sequence: 0 };
  return { record, event };
}
