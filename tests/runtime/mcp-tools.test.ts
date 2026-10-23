import { describe, expect, it } from 'vitest';
import { readOnlyMcpTools } from '../../lib/runtime/mcp/tools';

describe('governed MCP tool catalogue', () => {
  it('advertises exactly the bounded read-only tools', () => {
    expect(readOnlyMcpTools.map((tool) => tool.name)).toEqual([
      'memory_recall',
      'memory_trace',
      'memory_get_project_state',
      'memory_get_capture_status',
    ]);
  });

  it('requires a correlation ID for every tool call', () => {
    for (const tool of readOnlyMcpTools) {
      expect(tool.inputSchema.required).toContain('correlationId');
    }
  });
});
