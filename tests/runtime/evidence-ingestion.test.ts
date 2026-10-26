import { describe, expect, it } from 'vitest';
import { normalizeBrowserEvidence, normalizeBuildEvidence, normalizeRepositoryEvidence, normalizeRuntimeHealthEvidence, normalizeTestEvidence, persistEvidenceEvent } from '../../lib/runtime/evidence-ingestion';
import { replayProjectMemory } from '../../lib/runtime/project-memory';
import { TestRepository } from '../../lib/runtime/repositories/test-double';

const scope = { tenantId: 't1', bankId: 'b1' } as const;
const metadata = { projectId: 'p1', source: 'codex-runtime', observedAt: '2026-10-07T00:00:00.000Z' } as const;
describe('repository and runtime evidence ingestion', () => {
  it('normalizes all evidence sources with exact source references', () => {
    const repository = normalizeRepositoryEvidence(scope, metadata, { commit: 'abc123', branch: 'codex/v2', files: ['lib/runtime/contracts.ts'] });
    const test = normalizeTestEvidence(scope, metadata, { command: 'npm test', status: 'passed', testFiles: ['tests/runtime/evidence-ingestion.test.ts'] });
    const build = normalizeBuildEvidence(scope, metadata, { command: 'npm run build', status: 'passed', artifact: '.next' });
    const health = normalizeRuntimeHealthEvidence(scope, metadata, { endpoint: 'http://localhost:3020/health', status: 200, healthy: true });
    const browser = normalizeBrowserEvidence(scope, metadata, { url: 'http://localhost:3020/sandbox/memory', status: 200, title: 'Memory', viewport: '1440x900' });
    expect(repository.payload).toMatchObject({ sourceReference: 'abc123', evidence: { commit: 'abc123' } });
    expect(test.type).toBe('EvidenceTest');
    expect(build.type).toBe('EvidenceBuild');
    expect(health.payload).toMatchObject({ sourceReference: 'http://localhost:3020/health' });
    expect(browser.payload).toMatchObject({ sourceReference: 'http://localhost:3020/sandbox/memory#1440x900' });
  });
  it('rejects missing metadata and source identifiers', () => {
    expect(() => normalizeRepositoryEvidence(scope, { ...metadata, source: '' }, {})).toThrow('metadata');
    expect(() => normalizeTestEvidence(scope, metadata, { command: '', status: 'passed' })).toThrow('command');
    expect(() => normalizeRuntimeHealthEvidence(scope, metadata, { endpoint: '', status: 0, healthy: false })).toThrow('endpoint');
  });
  it('persists evidence idempotently and preserves scope isolation', async () => {
    const repository = new TestRepository('t1');
    const event = normalizeTestEvidence(scope, metadata, { command: 'npm test', status: 'passed' });
    await expect(persistEvidenceEvent(repository, event)).resolves.toMatchObject({ duplicate: false, event: { sequence: 1 } });
    await expect(persistEvidenceEvent(repository, event)).resolves.toMatchObject({ duplicate: true, event: { sequence: 1 } });
    await expect(persistEvidenceEvent(repository, { ...event, tenantId: 't2' })).rejects.toThrow('scope');
  });
  it('keeps raw evidence out of canonical memory until a later extractor commits a record', async () => {
    const repository = new TestRepository('t1');
    await persistEvidenceEvent(repository, normalizeTestEvidence(scope, metadata, { command: 'npm test', status: 'passed' }));
    await persistEvidenceEvent(repository, normalizeRuntimeHealthEvidence(scope, metadata, { endpoint: 'http://localhost:3020/health', status: 200, healthy: true }));
    expect(Object.keys(replayProjectMemory(await repository.listProjectEvents(scope, 'p1')).records)).toHaveLength(0);
  });
  it('persists evidence before bounded dispatch and reports queue admission', async () => {
    const repository = new TestRepository('t1');
    const event = normalizeBuildEvidence(scope, metadata, { command: 'npm run build', status: 'passed' });
    const seen: string[] = [];
    const result = await persistEvidenceEvent(repository, event, { enqueue: (queued) => { seen.push(queued.id); return true; } });
    expect(result.queued).toBe(true);
    expect(seen).toEqual([result.event.id]);
    expect(await repository.listProjectEvents(scope, 'p1')).toHaveLength(1);
  });
});
