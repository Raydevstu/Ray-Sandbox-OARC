import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { registerSession, resolveRegisteredBankProject } from '@/lib/server/session-register';
import { getPgPool, ensureSchema } from '@/lib/server/pg-client';

const BodySchema = z.object({
  sessionId: z.string().min(1),
  cwd: z.string().min(1).optional(),
  bank: z.string().min(1).optional(),
  project: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
}).strict();

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const body = BodySchema.parse(await request.json());
    const tenantId = principal.tenantId || body.tenantId || 'sandbox-tenant';
    const scopeForAuth = { tenantId, bankId: principal.bankId ?? body.bank ?? 'default', projectId: principal.projectId ?? body.project };
    // Registration is a memory/session coordination write; require memory:write.
    authorize(principal, 'memory:write', scopeForAuth as { tenantId: string; bankId: string; projectId?: string });

    let known: { bankId: string; cwdKey: string }[] = [];
    const pool = getPgPool();
    if (pool) {
      try {
        await ensureSchema();
        const { rows } = await pool.query(
          `SELECT bank_id, provenance FROM evidence WHERE tenant_id = $1 AND source = 'bank-watch-path'`,
          [tenantId],
        );
        known = (rows as { bank_id: string; provenance: unknown }[]).map((r) => {
          let cwd = '';
          try {
            const p = typeof r.provenance === 'string' ? JSON.parse(r.provenance) : r.provenance;
            cwd = String((p as { cwd?: string }).cwd ?? '');
          } catch { cwd = ''; }
          return { bankId: String(r.bank_id), cwdKey: cwd };
        });
      } catch {
        // best-effort: fall back to cwd-derived resolution without known banks
      }
    }

    const resolved = resolveRegisteredBankProject({ cwd: body.cwd, bank: body.bank ?? null, project: body.project ?? principal.projectId ?? null, knownBanks: known });
    const entry = registerSession({
      tenantId,
      sessionId: body.sessionId,
      bankId: resolved.bankId,
      projectId: resolved.projectId,
      cwd: body.cwd,
    });

    return NextResponse.json({
      ok: true,
      requestId,
      data: {
        sessionId: entry.sessionId,
        tenantId: entry.tenantId,
        bankId: entry.bankId,
        projectId: entry.projectId,
        cwd: entry.cwd,
        expiresAt: new Date(entry.expiresAt).toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid session-register payload' : error instanceof Error ? error.message : 'session-register failed';
    const status = message.includes('permission') || message.includes('scope') ? 403 : message.includes('invalid') ? 400 : 400;
    return NextResponse.json({ ok: false, requestId, error: message }, { status });
  }
}
