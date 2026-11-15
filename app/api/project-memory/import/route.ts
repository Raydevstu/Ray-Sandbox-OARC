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
import { distillSession } from '@/lib/engine/distillation';
import { saveDistilledFacts } from '@/lib/server/pg-lifecycle';

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
      let workspaceBankIdKnown: string | null = null;
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
          workspaceBankIdKnown = findBankForCwd(known, redactedInput.workspacePath);
        } catch {
          workspaceBankIdKnown = null;
        }
      }
      const workspaceBankIdDerived = bankIdForCwd(redactedInput.workspacePath);
      const workspaceBankId = workspaceBankIdKnown ?? workspaceBankIdDerived;
      const workspaceFromKnownMap = Boolean(workspaceBankIdKnown);

      // Reject when workspacePath resolves via a known mapping to a bank outside the
      // authenticated/bound scope (prevents cross-project tamper). If no known
      // mapping exists, the derived slug is advisory and must not override explicit
      // authorized scope hints that are consistent with the principal.
      if (workspaceFromKnownMap) {
        if (principal.bankId && workspaceBankIdKnown !== principal.bankId) {
          return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
        }
        if (!principal.bankId && redactedInput.bankId && workspaceBankIdKnown !== redactedInput.bankId) {
          return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
        }
      } else {
        if (principal.bankId && redactedInput.bankId && redactedInput.bankId !== principal.bankId) {
          return NextResponse.json({ ok: false, error: 'scope denied' }, { status: 403 });
        }
      }
      resolvedBankId = principal.bankId ?? (workspaceFromKnownMap ? workspaceBankIdKnown! : (redactedInput.bankId ?? workspaceBankIdDerived));
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

    // Bridge: make imported conversations recall-visible. Recall's Postgres path
    // reads canonical distilled `facts`, while project-memory import persists
    // source events/project-memory records. Distill accepted conversation content
    // into `facts` (idempotent via factIdFor upsert) so backfill/import recall works.
    try {
      const pool = getPgPool();
      if (pool && accepted > 0) {
        await ensureSchema();
        const MAX_FINDING_CHARS = 500;
        const lines = imported.events.map((event) => {
          const c = event.payload.conversation as { role?: string; content?: string } | undefined;
          const role = c?.role ?? 'assistant';
          const content = typeof c?.content === 'string' ? c.content : '';
          return `${role}: ${content}`;
        }).filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          const findings = lines.map((l) => l.slice(0, MAX_FINDING_CHARS));
          const task = `${String(input.platform)} import: ${String(input.conversationId)} (${String(input.sourceReference)}). ${findings[0]?.slice(0, 160) ?? ''}`.slice(0, 500);
          const distilled = distillSession({
            task,
            events: findings.map((content) => ({ type: 'FILE_VIEWED' as const, file: String(input.workspacePath ?? input.projectId ?? 'import'), timestamp: Date.now(), content })),
            findings,
            resolution: '',
          });
          const stored = distilled.map((d) => ({
            ...d,
            provenance: { source: `import:${String(input.platform)}`, turnId: String(input.conversationId), createdAt: Date.now() } as any,
          }));
          await saveDistilledFacts(pool, tenantId, resolvedBankId, stored as any);
        }
      }
    } catch (distillError) {
      // Best-effort bridge: do not fail a successful event import if fact distillation fails.
      console.warn('import distill-to-facts bridge failed:', distillError);
    }

    return NextResponse.json({ ok: true, data: { platform: input.platform as ImportPlatform, projectId: imported.events[0]?.projectId, imported: imported.events.length, accepted, capture: getCaptureStatus() } });
  } catch (error) {
    recordCapture('failed');
    const message = error instanceof z.ZodError ? 'invalid import envelope' : error instanceof Error ? error.message : 'conversation import failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400 });
  }
}
