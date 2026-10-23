import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize, authorizeProject } from '@/lib/runtime/auth';
import { getCaptureStatus } from '@/lib/runtime/capture-status';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { captureMcpGatewayEvent } from '@/lib/runtime/mcp/capture';
import { readOnlyMcpTools } from '@/lib/runtime/mcp/tools';
import { executeMcpTool } from '@/lib/runtime/mcp/service';
import { createMcpSession, touchMcpSession } from '@/lib/runtime/mcp/sessions';
import { createAsyncProjectMemoryDispatcher } from '@/lib/runtime/project-memory-pipeline';
import { recallMemory } from '@/lib/runtime/retrieval';
import { retainMemory } from '@/lib/runtime/retention';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { runtimeMetrics } from '@/lib/runtime/live-metrics';
import { projectDashboardMetrics } from '@/lib/runtime/project-dashboard-metrics';
import { recordCapture } from '@/lib/runtime/capture-status';

const JsonRpcSchema = z.object({ jsonrpc: z.literal('2.0'), id: z.union([z.string(), z.number(), z.null()]).optional(), method: z.string(), params: z.record(z.string(), z.unknown()).optional() });
const ContextSchema = z.object({
  provider: z.enum(['hermes', 'opencode']),
  agentId: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
  bankId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  conversationId: z.string().trim().min(1).optional(),
  runId: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(value.conversationId) !== Boolean(value.runId), 'exactly one conversation or run identifier is required');

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
  try {
    body = JsonRpcSchema.parse(await request.json());
  } catch {
    return rpcError(null, -32700, 'Invalid JSON-RPC request', 400);
  }

  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    if (body.method === 'initialize') {
      const context = ContextSchema.parse(body.params ?? {});
      authorize(principal, 'memory:read', { tenantId: context.tenantId, bankId: context.bankId });
      authorizeProject(principal, context);
      return rpc(body.id, { protocolVersion, capabilities: { tools: {} }, serverInfo }, 200, createMcpSession(principal, context));
    }
    const requestedSessionId = request.headers.get('mcp-session-id');
    const session = requestedSessionId ? touchMcpSession(requestedSessionId, principal) : undefined;
    if (!session) return rpcError(body.id, -32602, 'Unknown or expired MCP session', 404);
    if (body.method === 'notifications/initialized') return new NextResponse(null, { status: 202, headers: { 'MCP-Session-Id': session.id } });
    if (body.method === 'tools/list') return rpc(body.id, { tools: principal.scopes.has('memory:write') ? [...readOnlyMcpTools, { name: 'memory_retain', description: 'Store a scoped memory with provenance and idempotency.', inputSchema: { type: 'object', additionalProperties: false, properties: { content: { type: 'string', minLength: 1, maxLength: 20000 }, source: { type: 'string', minLength: 1 }, provenance: { type: 'string', minLength: 1 }, idempotencyKey: { type: 'string', minLength: 1 }, correlationId: { type: 'string', minLength: 1 } }, required: ['content', 'source', 'provenance', 'idempotencyKey', 'correlationId'] } }] : readOnlyMcpTools }, 200, session.id);
    if (body.method !== 'tools/call') return rpcError(body.id, -32601, 'Method not found', 200, session.id);

    const params = body.params ?? {};
    const name = z.string().parse(params.name);
    const args = z.record(z.string(), z.unknown()).parse(params.arguments ?? {});
    const startedAt = performance.now();
    const recordMcp = (outcome: 'success' | 'failure') => {
      const observation = { operation: 'mcp' as const, durationMs: Math.round(performance.now() - startedAt), outcome, toolName: name };
      runtimeMetrics.record(observation);
      projectDashboardMetrics.recordProjectOperation(session.context, { ...observation, app: session.context.provider });
    };
    const result = await executeMcpTool(session.context, principal, name, args, {
      isStoreConfigured: isRuntimeStoreConfigured,
      createRepository: createRuntimeRepository,
      recall: recallMemory,
      retain: (input, repository) => retainMemory(input as never, repository),
      listProjectEvents: (repository, scope, projectId) => repository.listProjectEvents(scope, projectId),
      captureStatus: getCaptureStatus,
      now: () => new Date().toISOString(),
    });
    if (!result.ok) {
      recordMcp('failure');
      return rpcError(body.id, -32602, result.error ?? 'MCP request failed', result.state === 'unauthorized' ? 403 : result.state === 'unavailable' ? 503 : 200, session.id);
    }
    const repository = createRuntimeRepository({ tenantId: session.context.tenantId, bankId: session.context.bankId });
    const dispatcher = createAsyncProjectMemoryDispatcher(repository, { tenantId: session.context.tenantId, bankId: session.context.bankId }, {
      consumer: 'mcp-gateway',
      maxQueue: 128,
      concurrency: 2,
      maxAttempts: 3,
      onProcessed: (processedEvent) => {
        const conversation = processedEvent.payload.conversation as { messageId?: string; timestamp?: string } | undefined;
        recordCapture('processed', conversation?.messageId, conversation?.timestamp ?? processedEvent.occurredAt);
      },
    });
    const capture = await captureMcpGatewayEvent(repository, session.context, {
      correlationId: String(args.correlationId),
      toolName: name,
      timestamp: new Date().toISOString(),
      requestSummary: { argumentNames: Object.keys(args) },
      observation: { durationMs: Math.round(performance.now() - startedAt), outcome: 'success' },
    }, dispatcher);
    if (!capture.queued) {
      recordMcp('failure');
      return rpcError(body.id, -32602, 'MCP capture unavailable', 503, session.id);
    }
    recordMcp('success');
    return rpc(body.id, { content: [{ type: 'text', text: JSON.stringify(result.data) }], structuredContent: result.data }, 200, session.id);
  } catch (error) {
    console.error('MCP request failed', { method: body.method, error: error instanceof Error ? error.message : String(error) });
    const isAuthFailure = error instanceof Error && (error.message.includes('credential') || error.message.includes('authentication'));
    const isScopeFailure = error instanceof Error && (error.message.includes('scope') || error.message.includes('permission') || error.message.includes('project is not permitted'));
    return rpcError(body.id, -32602, isAuthFailure || isScopeFailure ? 'access denied' : 'Invalid MCP request parameters', isAuthFailure ? 401 : isScopeFailure ? 403 : 400, request.headers.get('mcp-session-id') ?? undefined);
  }
}

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const sessionId = request.headers.get('mcp-session-id');
    const session = sessionId ? touchMcpSession(sessionId, principal) : undefined;
    if (!session) return NextResponse.json({ error: 'Unknown or expired MCP session' }, { status: 404 });
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(': mcp session ready\n\n')); controller.close(); } });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'MCP-Protocol-Version': protocolVersion, 'MCP-Session-Id': session.id } });
  } catch {
    return NextResponse.json({ error: 'MCP authentication failed' }, { status: 401 });
  }
}
