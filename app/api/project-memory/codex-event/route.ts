import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { normalizeCodexMcpEvent, normalizeCodexToolEvent, persistCodexProjectEvent } from '@/lib/runtime/codex-ingestion';
import { createAsyncProjectMemoryDispatcher } from '@/lib/runtime/project-memory-pipeline';
import { recordCapture, getCaptureStatus } from '@/lib/runtime/capture-status';
import { redactIncoming } from '@/lib/server/redaction';

const EnvelopeSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), conversationId: z.string().min(1), messageId: z.string().min(1), timestamp: z.string().datetime(), kind: z.enum(['mcp-call', 'tool-result']), method: z.string().min(1).optional(), name: z.string().min(1).optional(), role: z.enum(['user', 'assistant', 'tool', 'system']).optional(), content: z.string().optional(), arguments: z.record(z.string(), z.unknown()).optional(), result: z.unknown().optional() });

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = EnvelopeSchema.parse(await request.json());
    const redacted = redactIncoming(input);
    const redactedInput = redacted.payload as typeof input;
    const skipped = redacted.skipped;
    if (skipped > 0) recordCapture('skipped_redaction', input.messageId);
    authorize(principal, 'events:write', redactedInput);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const scope = { tenantId: redactedInput.tenantId, bankId: redactedInput.bankId };
    const repository = createRuntimeRepository(scope);
    const dispatcher = createAsyncProjectMemoryDispatcher(repository, scope, {
      consumer: 'codex-event-hook', maxQueue: 128, concurrency: 2, maxAttempts: 3,
      onProcessed: (processedEvent) => {
        const conversation = processedEvent.payload.conversation as { messageId?: string; timestamp?: string } | undefined;
        recordCapture('processed', conversation?.messageId, conversation?.timestamp ?? processedEvent.occurredAt);
      },
    });
    const metadata = { projectId: redactedInput.projectId, conversationId: redactedInput.conversationId, timestamp: redactedInput.timestamp };
    recordCapture('received', redactedInput.messageId, redactedInput.timestamp);
    const event = redactedInput.kind === 'mcp-call'
      ? normalizeCodexMcpEvent(scope, metadata, { messageId: redactedInput.messageId, method: redactedInput.method ?? 'tools/call', name: redactedInput.name, role: redactedInput.role ?? 'user', content: redactedInput.content, arguments: redactedInput.arguments, timestamp: redactedInput.timestamp })
      : normalizeCodexToolEvent(scope, metadata, { messageId: redactedInput.messageId, name: redactedInput.name ?? 'tool', result: redactedInput.result, timestamp: redactedInput.timestamp });
    recordCapture('normalized', redactedInput.messageId, redactedInput.timestamp);
    const persisted = await persistCodexProjectEvent(repository, event, dispatcher);
    recordCapture('persisted', redactedInput.messageId);
    if (persisted.queued) recordCapture('queued', redactedInput.messageId);
    return NextResponse.json({ ok: true, data: { eventId: persisted.event.id, duplicate: persisted.duplicate, queued: persisted.queued, capture: getCaptureStatus() } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid Codex event payload' : error instanceof Error ? error.message : 'Codex event ingestion failed';
    return NextResponse.json({ ok: false, error: message, capture: getCaptureStatus() }, { status: message.includes('credential') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400 });
  }
}
