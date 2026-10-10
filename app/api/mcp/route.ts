import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { buildMcpTools } from '@/lib/runtime/mcp/tools';
import { createRuntimeRepository } from '@/lib/runtime/repository';
import { retainMemory } from '@/lib/runtime/retention';
import { recallMemory } from '@/lib/runtime/retrieval';
import { deleteMemory, listEntities, updateMemory } from '@/lib/runtime/memory/service';
import { reflectMemory } from '@/lib/runtime/reflect/service';
import { createMcpSession, touchMcpSession } from '@/lib/runtime/mcp/sessions';
import { normalizeCodexMcpEvent, normalizeCodexToolEvent, persistCodexProjectEvent } from '@/lib/runtime/codex-ingestion';
import { createAsyncProjectMemoryDispatcher } from '@/lib/runtime/project-memory-pipeline';
import { recordCapture } from '@/lib/runtime/capture-status';

const ScopeSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1) });
const JsonRpcSchema = z.object({ jsonrpc: z.literal('2.0'), id: z.union([z.string(), z.number(), z.null()]).optional(), method: z.string(), params: z.record(z.string(), z.unknown()).optional() });

const protocolVersion = '2025-06-18';
const serverInfo = { name: 'hindsight-memory-slice', version: '0.1.0' };

function rpc(id: string | number | null | undefined, result: unknown, status = 200, sessionId?: string) {
  const headers = new Headers({ 'MCP-Protocol-Version': protocolVersion });
  if (sessionId) headers.set('MCP-Session-Id', sessionId);
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result }, { status, headers });
}

function rpcError(id: string | number | null | undefined, code: number, message: string, status = 200, sessionId?: string) {
  const headers = new Headers({ 'MCP-Protocol-Version': protocolVersion });
  if (sessionId) headers.set('MCP-Session-Id', sessionId);
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status, headers });
}

export async function POST(request: Request) {
  let body: z.infer<typeof JsonRpcSchema>;
  try { body = JsonRpcSchema.parse(await request.json()); }
  catch { return rpcError(null, -32700, 'Invalid JSON-RPC request', 400); }

  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const requestedSessionId = request.headers.get('mcp-session-id');
    const existingSession = requestedSessionId ? touchMcpSession(requestedSessionId) : undefined;
    if (requestedSessionId && !existingSession) return rpcError(body.id, -32600, 'Unknown or expired MCP session', 404);
    if (body.method === 'initialize') {
      const sessionId = existingSession?.id ?? createMcpSession(principal);
      return rpc(body.id, { protocolVersion, capabilities: { tools: {} }, serverInfo }, 200, sessionId);
    }
    if (body.method === 'notifications/initialized') return new NextResponse(null, { status: 202, headers: { 'MCP-Session-Id': existingSession?.id ?? '' } });
    if (body.method === 'tools/list') {
      const tools = buildMcpTools({ retain: async () => ({}), recall: async () => ({}), reflect: async () => ({}), update: async () => ({}), remove: async () => ({}), entities: async () => ({}) });
      return rpc(body.id, { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }, 200, existingSession?.id);
    }
    if (body.method !== 'tools/call') return rpcError(body.id, -32601, `Method not found: ${body.method}`, 200, existingSession?.id);

    const params = body.params ?? {};
    const name = z.string().parse(params.name);
    const args = z.record(z.string(), z.unknown()).parse(params.arguments ?? {});
    const scope = ScopeSchema.parse(args);
    const permission = name === 'memory_recall' || name === 'memory_reflect' || name === 'memory_list_entities' ? 'memory:read' : ['memory_retain', 'memory_update', 'memory_delete'].includes(name) ? 'memory:write' : null;
    if (!permission) return rpcError(body.id, -32602, `Unknown tool: ${name}`, 200, existingSession?.id);
    authorize(principal, permission, scope);
    const repository = createRuntimeRepository(scope);
    const dispatcher = createAsyncProjectMemoryDispatcher(repository, scope, { consumer: 'mcp-project-memory', maxQueue: 128, concurrency: 2, maxAttempts: 3 });
    const tools = buildMcpTools({
      retain: (input) => retainMemory({ ...input, tenantId: scope.tenantId, bankId: scope.bankId } as Parameters<typeof retainMemory>[0], repository),
      recall: (input) => recallMemory({ ...input, tenantId: scope.tenantId, bankId: scope.bankId } as Parameters<typeof recallMemory>[0], repository),
      reflect: async (input) => reflectMemory(scope, z.string().parse(input.query), repository),
      update: async (input) => updateMemory(scope, z.string().parse(input.memoryId ?? input.memory_id), z.string().parse(input.text), repository),
      remove: async (input) => deleteMemory(scope, z.string().parse(input.memoryId ?? input.memory_id), repository),
      entities: async (input) => listEntities(scope, typeof input.topK === 'number' ? input.topK : 10, repository),
    });
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) return rpcError(body.id, -32602, `Unknown tool: ${name}`, 200, existingSession?.id);
    const result = await tool.execute(args);
    const connector = { projectId: typeof args.projectId === 'string' ? args.projectId : scope.bankId, conversationId: existingSession?.id ?? 'mcp-request', timestamp: new Date().toISOString() };
    const messageId = String(body.id ?? `${name}-${Date.now()}`);
    recordCapture('received', messageId, connector.timestamp);
    const conversationEvent = normalizeCodexMcpEvent(scope, connector, { messageId, method: body.method, name, role: 'user', content: JSON.stringify(args) });
    recordCapture('normalized', messageId, connector.timestamp);
    void persistCodexProjectEvent(repository, conversationEvent, dispatcher)
      .then(() => { recordCapture('persisted', messageId); recordCapture('queued', messageId); return persistCodexProjectEvent(repository, normalizeCodexToolEvent(scope, connector, { messageId: `${messageId}:result`, name, result }), dispatcher); })
      .then(() => recordCapture('processed', `${messageId}:result`))
      .catch(() => recordCapture('failed', messageId));
    return rpc(body.id, { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result }, 200, existingSession?.id);
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Invalid MCP request parameters' : error instanceof Error ? error.message : 'MCP request failed';
    const status = message.includes('credential') || message.includes('scope') || message.includes('permission') ? 401 : 200;
    return rpcError(body.id, -32602, message, status, request.headers.get('mcp-session-id') ?? undefined);
  }
}

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const sessionId = request.headers.get('mcp-session-id');
    const session = sessionId ? touchMcpSession(sessionId) : undefined;
    if (sessionId && !session) return NextResponse.json({ error: 'Unknown or expired MCP session' }, { status: 404 });
    const id = session?.id ?? createMcpSession(principal);
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(': mcp session ready\n\n')); controller.close(); } });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'MCP-Protocol-Version': protocolVersion, 'MCP-Session-Id': id } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'MCP authentication failed' }, { status: 401 });
  }
}
