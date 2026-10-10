import { describe, expect, it } from 'vitest';
// The plugin runs in Node directly; these helpers are intentionally tested through the same ESM module.
import { buildCaptureEnvelope, deriveProjectIdentity, parseTranscriptJsonl, redactValue } from '../../plugins/ray-memory/scripts/capture-support.mjs';

describe('Codex transcript-aware capture', () => {
  it('parses bounded JSONL context while skipping malformed lines', () => {
    const raw = [JSON.stringify({ id: 'm1', role: 'user', content: 'Keep this decision.' }), '{malformed-json', JSON.stringify({ message: { uuid: 'm2', role: 'assistant', content: { text: 'Acknowledged.' } } })].join('\n');
    expect(parseTranscriptJsonl(raw)).toMatchObject([{ id: 'm1', role: 'user' }, { id: 'm2', role: 'assistant', content: 'Acknowledged.' }]);
  });

  it('redacts secret fields and never retains transcript paths', () => {
    expect(redactValue({ apiKey: 'do-not-send', nested: { authorization: 'Bearer hidden' }, transcript_path: 'C:\\private\\transcript.jsonl' })).toEqual({ apiKey: '[REDACTED_SECRET]', nested: { authorization: '[REDACTED_SECRET]' } });
  });

  it('prefers hook fields, merges transcript context, and is deterministic across retries', () => {
    const input = { hook_event_name: 'Stop', session_id: 'session-1', prompt: 'User requirement', last_assistant_message: 'Assistant response', cwd: 'D:\\Projects\\repo', timestamp: '2026-10-09T10:00:00.000Z' };
    const options = { repositoryRoot: 'D:\\Projects\\repo', transcriptRaw: JSON.stringify({ id: 'm1', role: 'user', content: 'User requirement' }) };
    const first = buildCaptureEnvelope(input, options);
    const second = buildCaptureEnvelope(input, options);
    expect(first).toEqual(second);
    expect(first.messages).toHaveLength(2);
    expect(first.messages[0]).toMatchObject({ role: 'user', content: 'User requirement' });
    expect(first.messages[1]).toMatchObject({ role: 'assistant', content: 'Assistant response' });
    const { timestamp: _timestamp, ...withoutTimestamp } = input;
    expect(buildCaptureEnvelope(withoutTimestamp)).toEqual(buildCaptureEnvelope(withoutTimestamp));
  });

  it('derives project identity from repository metadata instead of its parent directory', () => {
    const identity = deriveProjectIdentity({ cwd: 'D:\\Projects\\parent', repository: { root: 'D:\\Projects\\repo', remote: 'https://example.invalid/ray.git' } });
    expect(identity.workspacePath).toBe('D:\\Projects\\repo');
    expect(identity.projectId).toMatch(/^codex-[a-f0-9]{24}$/);
    expect(identity.projectId).not.toContain('parent');
  });
});
