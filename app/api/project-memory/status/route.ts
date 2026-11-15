import { NextResponse } from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getCaptureStatus } from '@/lib/runtime/capture-status';
import { getRetentionSweeperStatus } from '@/lib/server/retention-sweeper';
import { isRuntimeStoreConfigured, checkRuntimeStore } from '@/lib/runtime/repository';

export const dynamic = 'force-dynamic';

function rayMemoryStateDir(): string {
  return process.env.RAY_MEMORY_STATE_DIR
    || path.join(process.env.LOCALAPPDATA || os.homedir(), 'ray-memory');
}

function readClientStatuses(): Array<Record<string, unknown>> {
  const base = rayMemoryStateDir();
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const tryRead = (file: string) => {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const key = file.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ sourceFile: file, ...parsed });
    } catch {
      // ignore unreadable/non-json
    }
  };

  try {
    // Per-platform status files written by plugins/ray-memory/core.mjs: <stateDir>/status/<platform>.json
    const statusDir = path.join(base, 'status');
    if (fs.existsSync(statusDir)) {
      for (const name of fs.readdirSync(statusDir)) {
        if (name.endsWith('.json')) tryRead(path.join(statusDir, name));
      }
    }
    // Optional aggregate file (<stateDir>/status.json) if present
    const aggregate = path.join(base, 'status.json');
    if (fs.existsSync(aggregate)) tryRead(aggregate);
  } catch {
    // filesystem unavailable/not local - return empty
  }

  return out.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
}

export async function GET() {
  const capture = getCaptureStatus();
  const clientStatuses = readClientStatuses();
  const retentionSweeper = getRetentionSweeperStatus();
  let storeMode: 'postgres' | 'degraded' | 'not_configured' = 'not_configured';
  try {
    if (isRuntimeStoreConfigured()) {
      const status = await checkRuntimeStore();
      storeMode = status === 'healthy' ? 'postgres' : 'degraded';
    }
  } catch {
    storeMode = isRuntimeStoreConfigured() ? 'degraded' : 'not_configured';
  }

  return NextResponse.json({
    ok: true,
    data: {
      ...capture,
      capture,
      clientStatuses,
      retentionSweeper,
      storeMode,
    },
  });
}
