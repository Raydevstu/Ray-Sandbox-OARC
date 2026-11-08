import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { createRetainHandler, readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '../../../../../lib/runtime/repository';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope = await readProjectScope(request);
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', scope);

    const pool = getPgPool();
    if (pool) {
      try {
        await ensureSchema();
        const body = await request.json().catch(() => ({}));
        const content = String(body?.content ?? '');
        const bankId = String(body?.bankId ?? scope.bankId ?? 'default');
        const scopes = body?.scopes ?? {};
        const tags = Array.isArray(body?.tags) ? body.tags : [];
        const entities = Array.isArray(body?.entities) ? body.entities : [];
        const factId = `fact-${Date.now()}`;
        await pool.query(
          `INSERT INTO memory_facts (id, bank_id, text, network, confidence, scopes, tags, entities)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [factId, bankId, content, "world", 0.8, JSON.stringify(scopes), tags, entities]
        );
        return NextResponse.json({ ok: true, data: { fact: { id: factId } } });
      } catch (pgError) {
        // PostgreSQL unreachable — fall back to localStorage
        console.warn('PostgreSQL unavailable, falling back to localStorage:', pgError);
      }
    }

    if (!isRuntimeStoreConfigured()) {
      return NextResponse.json({ ok: true, state: "localStorage-only" });
    }
    return await createRetainHandler(createRuntimeRepository(scope))(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'retain request failed';
    const status = message.includes('credential') || message.includes('authentication') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400;
    return apiFailure(requestId, message, status === 401 || status === 403 ? 'unauthorized' : 'failed', status, { retryable: false });
  }
}
