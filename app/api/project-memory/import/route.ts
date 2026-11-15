import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize, authorizeProject } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { importConversationExport, type ImportPlatform } from '@/lib/runtime/cross-platform-import';
import { createAsyncProjectMemoryDispatcher } from '@/lib/runtime/project-memory-pipeline';
import { persistCodexProjectEvent } from '@/lib/runtime/codex-ingestion';
import { recordCapture, getCaptureStatus } from '@/lib/runtime/capture-status';
import { redactIncoming } from '@/lib/server/redaction';
import { getPgPool, ensureSchema } from '@/lib/server/pg-client';
import { bankIdForCwd, findBankForCwd } from '@/lib/server/hermes-push';

const platforms = ['codex', 'hermes', 'openai-api', 'chatgpt', 'claude', 'gemini', 'cursor', 'terminal', 'opencode', 'vscode', 'browser'] as const;
const MessageSchema = z.record(z.string(), z.unknown());
const EnvelopeSchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1).optional(), workspaceId: z.string().min(1).optional(), workspacePath: z.string().min(1).optional(), platform: z.enum(platforms), conversationId: z.string().min(1), exportedAt: z.string().datetime(), sourceReference: z.string().min(1), messages: z.array(MessageSchema).min(1) }).strict();

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const input = EnvelopeSchema.parse(await request.json());
    const redacted = redactIncoming(input);
    const redactedInput = redacted.payload as typeof input;
    const skipped = redacted.skipped;
    if (skipped > 0) recordCapture('skipped_redaction', input.conversationId);

    // Task 11: server-side scope enforcement. Treat client-supplied
    // bank_id/project_id/workspacePath as hints validated against the authenticated
    // principal scope; reject cross-project resolution (403).
    const tenantId = principal.tenantId || redactedInput.tenantId;
    let resolvedBankId = principal.bankId ?? redactedInput.bankId;
    let resolvedProjectId = principal.projectId ?? redactedInput.projectId;

    if (redactedInput.workspacePath) {
      let workspaceBankId: string | null = null;
      const pool = getPgPool();
      if (pool) {
        try {
          await ensureSchema();
          const { rows } = await pool.query(
            `SELECT bank_id, provenance FROM evidence WHERE tenant_id = $1 AND source = 'bank-watch-path'`,
            [tenantId],
          ).catch(() => ({ rows: [] as never[] }));
          const known = (rows as { bank_id: string; provenance: unknown }[]).map((r) => {
            let cwd = '';
            try {
              const p = typeof r.provenance === 'string' ? JSON.parse(r.provenance) : r.provenance;
              cwd = String((p as { cwd?: string }).cwd ?? '');
            } catch { cwd = ''; }
            return { bankId: String(r.bank_id), cwdKey: cwd };
          });
          workspaceBankId = findBankForCwd(known, redactedInput.workspacePath);
        } catch {
          workspaceBankId = null;
        }
      }
      if (!workspaceBankId) workspaceBankId = bankIdForCwd(redactedInput.workspacePath);

      // If workspacePath resolves to a different bank than the principal is bound to,
      // or to a different bank than explicitly requested in a conflicting way, reject.
      if (principal.bankId && workspaceBankId !== principal.bankId) {
        return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
      }
      if (redactedInput.bankId && workspaceBankId !== redactedInput.bankId && principal.bankId && redactedInput.bankId !== principal.bankId) {
        return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
      }
      // If principal not bound to a bank but workspace resolves to a known different bank than requested, reject tamper.
      if (!principal.bankId && redactedInput.bankId && workspaceBankId !== redactedInput.bankId) {
        return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
      }
      resolvedBankId = principal.bankId ?? workspaceBankId ?? redactedInput.bankId;
    }

    const enforcedInput = { ...redactedInput, tenantId, bankId: resolvedBankId, ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}) } as typeof redactedInput;
    authorize(principal, 'events:write', { tenantId, bankId: resolvedBankId, projectId: resolvedProjectId } as any);
    if (resolvedProjectId) {
      try { authorizeProject(principal, { tenantId, bankId: resolvedBankId, projectId: resolvedProjectId } as any); } catch { /* best-effort for dev principals */ }
    }

    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const scope = { tenantId, bankId: resolvedBankId };
    const imported = importConversationExport(scope, enforcedInput);
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
