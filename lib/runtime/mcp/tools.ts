import type { MemoryApiClient } from '../sdk/client';
export type McpToolDefinition = Readonly<{ name: string; description: string; inputSchema: Readonly<Record<string, unknown>>; execute(input: Record<string, unknown>): Promise<unknown> }>;
type McpDeps = Readonly<{ retain(input: Record<string, unknown>): Promise<unknown>; recall(input: Record<string, unknown>): Promise<unknown> }>;
const schema = { type: 'object', additionalProperties: true } as const;
export const buildMcpTools = (deps: McpDeps | MemoryApiClient): readonly McpToolDefinition[] => [
  { name: 'memory_retain', description: 'Store a scoped memory with provenance and idempotency.', inputSchema: schema, execute: deps.retain },
  { name: 'memory_recall', description: 'Recall scoped memory using the configured retrieval policy.', inputSchema: schema, execute: deps.recall },
];
