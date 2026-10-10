import { describe, expect, it } from 'vitest';
import { createCodexImport, createHermesImport, createOpenAIImport, createPlatformImportEnvelope } from '../../lib/runtime/platform-connectors';

const input = { conversationId: 'c1', sourceReference: 'host://c1', workspaceId: 'workspace-1', messages: [{ role: 'user', content: 'Decision: preserve provenance.' }] };

describe('platform connectors', () => {
  it('creates the same envelope shape for Codex, Hermes, and OpenAI', () => {
    expect(createCodexImport(input).platform).toBe('codex');
    expect(createHermesImport(input).platform).toBe('hermes');
    expect(createOpenAIImport(input).platform).toBe('openai-api');
  });

  it('requires a project or workspace identity', () => {
    expect(() => createPlatformImportEnvelope({ platform: 'codex', conversationId: 'c1', sourceReference: 'host://c1', messages: input.messages })).toThrow('projectId or workspaceId');
  });
});
