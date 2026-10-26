import { afterEach, describe, expect, it } from 'vitest';
import { clearMcpSessions, createMcpSession, touchMcpSession } from '../../lib/runtime/mcp/sessions';

const principal = { subject: 'agent-a', tenantId: 'tenant-a', scopes: new Set(['memory:read' as const]), allowedProjectIds: ['project-a'], source: 'dev' as const };
const otherPrincipal = { ...principal, subject: 'agent-b' };
const context = {
  provider: 'hermes' as const,
  agentId: 'hermes-agent-a',
  tenantId: 'tenant-a',
  bankId: 'bank-a',
  projectId: 'project-a',
  conversationId: 'conversation-a',
};

afterEach(() => clearMcpSessions());

describe('MCP sessions', () => {
  it('binds connector context to the authenticated principal', () => {
    const id = createMcpSession(principal, context);

    expect(touchMcpSession(id, principal)).toMatchObject({
      principal: { subject: 'agent-a', tenantId: 'tenant-a' },
      context,
    });
  });

  it('rejects a session replayed by another authenticated subject', () => {
    const id = createMcpSession(principal, context);

    expect(touchMcpSession(id, otherPrincipal)).toBeUndefined();
  });
});
