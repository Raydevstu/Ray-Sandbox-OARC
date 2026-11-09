import { NextResponse } from 'next/server';
import { authenticateRequest, authorize } from '../../../../../lib/runtime/auth';
import { readProjectScope } from '../../../../../lib/runtime/api-handlers';
import { parseRuntimeConfig } from '../../../../../lib/runtime/config';
import { apiFailure } from '../../../../../lib/runtime/api-envelope';
import { getPgPool, ensureSchema } from '../../../../../lib/server/pg-client';
import { importOnce } from '../../../../../lib/server/import-worker';
import { parseImportBody } from '../../../../../lib/server/import-route-helper';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const STATE_FILE = join(process.cwd(), '.data', 'import-watchers.json');

type WatcherState = Record<string, { path: string; hashes: string[]; lastRun: number; lastImported: number }>;

function loadState(): WatcherState {
  try {
    if (!existsSync(STATE_FILE)) return {};
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(s: WatcherState): void {
  try {
    mkdirSync(join(process.cwd(), '.data'), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(s));
  } catch {
    // best effort; watcher still works for once-runs
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  try {
    const scope: any = {};
    try {
      Object.assign(scope, await readProjectScope(request));
    } catch { /* scoped by body */ }
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    authorize(principal, 'memory:write', scope);

    const body = await request.json().catch(() => ({}));
    const { action, bankId, path } = parseImportBody(body);
    const tenantId = String(scope.tenantId ?? 'sandbox-tenant');

    if (action === 'stop') {
      const state = loadState();
      delete state[bankId];
      saveState(state);
      return NextResponse.json({ ok: true, data: { action, bankId, watching: false } });
    }

    const pool = getPgPool();
    if (!pool) {
      return NextResponse.json({ ok: true, state: 'localStorage-only', imported: 0 });
    }
    await ensureSchema();
    const state = loadState();
    const known = state[bankId]?.hashes ?? [];
    const out = await importOnce(pool, tenantId, bankId, path, known);
    state[bankId] = { path, hashes: out.hashes, lastRun: Date.now(), lastImported: out.imported };
    saveState(state);
    return NextResponse.json({ ok: true, data: { action, bankId, ...out, watching: action === 'start' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'import request failed';
    return apiFailure(requestId, message, 'failed', 400, { retryable: true });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bankId = url.searchParams.get('bankId') ?? 'default';
    const state = loadState();
    const w = state[bankId];
    return NextResponse.json({ ok: true, data: { watching: !!w, ...(w ?? {}) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'import status failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
