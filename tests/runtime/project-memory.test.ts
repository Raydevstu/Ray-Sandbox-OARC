import { describe, expect, it } from 'vitest';
import { ConversationEventSchema, ProjectMemoryRecordSchema } from '../../lib/runtime/schemas';
import { applyProjectEvent, replayProjectMemory, replayProjectMemoryAtSequence } from '../../lib/runtime/project-memory';
import { TestRepository } from '../../lib/runtime/repositories/test-double';
import { generateProjectManifest, renderProjectManifestMarkdown } from '../../lib/runtime/project-manifest';

const scope = { tenantId: 't1', bankId: 'b1' } as const;
const record = { ...scope, id: 'r1', projectId: 'p1', type: 'decision', title: 'Use PostgreSQL', content: 'Canonical persistence uses PostgreSQL.', status: 'active', confidence: 1, importance: 'critical', source: { platform: 'codex', timestamp: '2026-10-07T00:00:00.000Z' }, evidence: [{ kind: 'file', reference: 'db/schema.ts', observedAt: '2026-10-07T00:00:00.000Z' }], supersedes: [], relatedRecords: [], createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z' } as const;
describe('project memory contracts and replay', () => {
  it('validates canonical memory and conversation envelopes', () => { expect(ProjectMemoryRecordSchema.parse(record)).toEqual(record); expect(ConversationEventSchema.parse({ ...scope, projectId: 'p1', platform: 'codex', conversationId: 'c1', messageId: 'm1', role: 'user', content: 'decide this', timestamp: '2026-10-07T00:00:00.000Z' }).projectId).toBe('p1'); });
  it('persists append-only events and replays the same projection deterministically', async () => {
    const repository = new TestRepository('t1');
    await repository.appendProjectEvent({ ...scope, id: 'e2', projectId: 'p1', type: 'ProjectMemoryStatusChanged', payload: { recordId: 'r1', status: 'verified' }, occurredAt: '2026-10-07T00:00:02.000Z', sequence: 2 });
    await repository.appendProjectEvent({ ...scope, id: 'e1', projectId: 'p1', type: 'ProjectMemoryRecorded', payload: { record }, occurredAt: '2026-10-07T00:00:01.000Z', sequence: 1 });
    const events = await repository.listProjectEvents(scope, 'p1');
    expect(replayProjectMemory(events)).toEqual(replayProjectMemory([...events].reverse()));
    expect(replayProjectMemory(events).records.r1.status).toBe('verified');
  });
  it('replays a read-only historical projection at a sequence cutoff', () => {
    const events = [
      { ...scope, id: 'e1', projectId: 'p1', type: 'ProjectMemoryRecorded' as const, payload: { record }, occurredAt: '2026-10-07T00:00:01.000Z', sequence: 1 },
      { ...scope, id: 'e2', projectId: 'p1', type: 'ProjectMemoryStatusChanged' as const, payload: { recordId: 'r1', status: 'verified' }, occurredAt: '2026-10-07T00:00:02.000Z', sequence: 2 },
    ];
    expect(replayProjectMemoryAtSequence(events, 1)).toEqual(replayProjectMemory(events.slice(0, 1)));
  });
  it('does not mutate the prior projection when applying a later event', () => { const first = applyProjectEvent({ records: { r1: record } }, { ...scope, id: 'e', projectId: 'p1', type: 'ProjectMemoryStatusChanged', payload: { recordId: 'r1', status: 'stale' }, occurredAt: '2026-10-07T00:00:02.000Z', sequence: 2 }); expect(first.records.r1.status).toBe('stale'); expect(record.status).toBe('active'); });
  it('generates the manifest from replayed records and renders a stable entry point', () => { const manifest = generateProjectManifest('p1', { records: { r1: record } }, '2026-10-07T00:00:03.000Z'); expect(manifest.sections.active).toHaveLength(1); expect(renderProjectManifestMarkdown(manifest)).toContain('Use PostgreSQL'); });
});
