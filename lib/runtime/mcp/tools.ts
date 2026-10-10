import type { MemoryApiClient } from '../sdk/client';
export type McpToolDefinition = Readonly<{ name: string; description: string; inputSchema: Readonly<Record<string, unknown>>; execute(input: Record<string, unknown>): Promise<unknown> }>;
type McpDeps = Readonly<{ retain(input: Record<string, unknown>): Promise<unknown>; recall(input: Record<string, unknown>): Promise<unknown>; reflect?(input: Record<string, unknown>): Promise<unknown>; update?(input: Record<string, unknown>): Promise<unknown>; remove?(input: Record<string, unknown>): Promise<unknown>; entities?(input: Record<string, unknown>): Promise<unknown> }>;
const schema = { type: 'object', additionalProperties: true } as const;
export const buildMcpTools = (deps: McpDeps | MemoryApiClient): readonly McpToolDefinition[] => [
  { name: 'memory_retain', description: 'Store a scoped memory with provenance and idempotency.', inputSchema: schema, execute: deps.retain },
  { name: 'memory_recall', description: 'Recall scoped memory using the configured retrieval policy.', inputSchema: schema, execute: deps.recall },
  ...('reflect' in deps && deps.reflect ? [{ name: 'memory_reflect', description: 'Compose a grounded answer from scoped memories.', inputSchema: schema, execute: deps.reflect }] : []),
  ...('update' in deps && deps.update ? [{ name: 'memory_update', description: 'Create a new revision for a scoped memory.', inputSchema: schema, execute: deps.update }] : []),
  ...('remove' in deps && deps.remove ? [{ name: 'memory_delete', description: 'Tombstone a scoped memory without erasing its history.', inputSchema: schema, execute: deps.remove }] : []),
  ...('entities' in deps && deps.entities ? [{ name: 'memory_list_entities', description: 'List scoped entities ranked by graph degree.', inputSchema: schema, execute: deps.entities }] : []),
];
