import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { importConversationExport, type ImportPlatform } from '@/lib/runtime/cross-platform-import';
import { createAsyncProjectMemoryDispatcher } from '@/lib/runtime/project-memory-pipeline';
import { persistCodexProjectEvent } from '@/lib/runtime/codex-ingestion';
import { recordCapture, getCaptureStatus } from '@/lib/runtime/capture-status';

const platforms = ['codex', 'hermes', 'openai-api', 'chatgpt', 'claude', 'gemini', 'cursor', 'terminal', 'opencode', 'vscode'] as const;
const MessageSchema = z.record(z.string(), z.unknown());
const EnvelopeSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1).optional(), workspaceId: z.string().min(1).optional(), workspacePath: z.string().min(1).optional(), platform: z.enum(platforms), conversationId: z.string().min(1), exportedAt: z.string().datetime(), sourceReference: z.string().min(1), messages: z.array(MessageSchema).min(1) }).strict();

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = EnvelopeSchema.parse(await request.json());
    authorize(principal, 'events:write', input);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const scope = { tenantId: input.tenantId, bankId: input.bankId };
    const imported = importConversationExport(scope, input);
    if (imported.gaps.length) return NextResponse.json({ ok: false, error: imported.gaps[0].reason, gaps: imported.gaps }, { status: 400 });
    const repository = createRuntimeRepository(scope);
    const dispatcher = createAsyncProjectMemoryDispatcher(repository, scope, {
      consumer: `import-${input.platform}`, maxQueue: 128, concurrency: 2, maxAttempts: 3,
      onProcessed: (processedEvent) => {
        const conversation = processedEvent.payload.conversation as { messageId?: string; timestamp?: string } | undefined;
        recordCapture('processed', conversation?.messageId, conversation?.timestamp ?? processedEvent.occurredAt);
      },
    });
    let accepted = 0;
    for (const event of imported.events) {
      const conversation = event.payload.conversation as { messageId?: string; timestamp?: string } | undefined;
      recordCapture('received', conversation?.messageId, conversation?.timestamp ?? event.occurredAt);
      recordCapture('normalized', conversation?.messageId, conversation?.timestamp ?? event.occurredAt);
      const result = await persistCodexProjectEvent(repository, event, dispatcher);
      recordCapture('persisted', conversation?.messageId, conversation?.timestamp ?? event.occurredAt);
      if (result.queued || result.duplicate) accepted += 1;
      if (result.queued) recordCapture('queued', conversation?.messageId, conversation?.timestamp ?? event.occurredAt);
      else if (!result.duplicate) recordCapture('failed', conversation?.messageId, conversation?.timestamp ?? event.occurredAt);
    }
    return NextResponse.json({ ok: true, data: { platform: input.platform as ImportPlatform, projectId: imported.events[0]?.projectId, imported: imported.events.length, accepted, capture: getCaptureStatus() } });
  } catch (error) {
    recordCapture('failed');
    const message = error instanceof z.ZodError ? 'invalid import envelope' : error instanceof Error ? error.message : 'conversation import failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400 });
  }
}
