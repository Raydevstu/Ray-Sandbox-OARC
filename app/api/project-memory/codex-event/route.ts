import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { normalizeCodexMcpEvent, normalizeCodexToolEvent, persistCodexProjectEvent } from '@/lib/runtime/codex-ingestion';
import { createAsyncProjectMemoryDispatcher } from '@/lib/runtime/project-memory-pipeline';
import { recordCapture, getCaptureStatus } from '@/lib/runtime/capture-status';

const EnvelopeSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), conversationId: z.string().min(1), messageId: z.string().min(1), timestamp: z.string().datetime(), kind: z.enum(['mcp-call', 'tool-result']), method: z.string().min(1).optional(), name: z.string().min(1).optional(), role: z.enum(['user', 'assistant', 'tool', 'system']).optional(), content: z.string().optional(), arguments: z.record(z.string(), z.unknown()).optional(), result: z.unknown().optional() });

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = EnvelopeSchema.parse(await request.json());
    if (principal.tenantId !== input.tenantId) return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    const repository = createRuntimeRepository(scope);
    const dispatcher = createAsyncProjectMemoryDispatcher(repository, scope, {
      consumer: 'codex-event-hook', maxQueue: 128, concurrency: 2, maxAttempts: 3,
      onProcessed: (processedEvent) => {
        const conversation = processedEvent.payload.conversation as { messageId?: string; timestamp?: string } | undefined;
        recordCapture('processed', conversation?.messageId, conversation?.timestamp ?? processedEvent.occurredAt);
      },
    });
    const metadata = { projectId: input.projectId, conversationId: input.conversationId, timestamp: input.timestamp };
    recordCapture('received', input.messageId, input.timestamp);
    const event = input.kind === 'mcp-call'
      ? normalizeCodexMcpEvent(scope, metadata, { messageId: input.messageId, method: input.method ?? 'tools/call', name: input.name, role: input.role ?? 'user', content: input.content, arguments: input.arguments, timestamp: input.timestamp })
      : normalizeCodexToolEvent(scope, metadata, { messageId: input.messageId, name: input.name ?? 'tool', result: input.result, timestamp: input.timestamp });
    recordCapture('normalized', input.messageId, input.timestamp);
    const persisted = await persistCodexProjectEvent(repository, event, dispatcher);
    recordCapture('persisted', input.messageId);
    if (persisted.queued) recordCapture('queued', input.messageId);
    return NextResponse.json({ ok: true, data: { eventId: persisted.event.id, duplicate: persisted.duplicate, queued: persisted.queued, capture: getCaptureStatus() } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid Codex event payload' : error instanceof Error ? error.message : 'Codex event ingestion failed';
    return NextResponse.json({ ok: false, error: message, capture: getCaptureStatus() }, { status: message.includes('credential') ? 401 : 400 });
  }
}
