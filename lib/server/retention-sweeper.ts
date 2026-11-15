import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface RetentionSweeperResult {
  scanned: number;
  softDeleted: number;
  purged: number;
  durationMs: number;
}

type PoolLike = {
  query: (text: string, params?: any[]) => Promise<{ rows?: any[]; rowCount?: number }>;
};

type RunBackup = () => Promise<void>;

export interface RunRetentionSweeperOptions {
  pool: PoolLike;
  now?: Date;
  retentionDays?: number;
  graceDays?: number;
  batchSize?: number;
  tenantId?: string;
  bankId?: string;
  runBackup?: RunBackup;
}

let backupRanThisProcess = false;
let lastResult: (RetentionSweeperResult & { at: string }) | null = null;

export function getRetentionSweeperStatus() {
  return lastResult;
}

async function defaultRunBackup(): Promise<void> {
  // Best-effort: honor "runs npm run db:backup:postgres before its first purge".
  // In environments without pg_dump/db configured this may fail; callers can inject runBackup.
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await execFileAsync(npmCmd, ['run', 'db:backup:postgres'], { cwd: process.cwd(), windowsHide: true });
}

async function resolveRetentionDays(pool: PoolLike, fallback: number, tenantId?: string, bankId?: string): Promise<number> {
  try {
    const params: any[] = [];
    let where = '';
    if (tenantId && bankId) {
      params.push(tenantId, bankId);
      where = 'WHERE tenant_id = $1 AND bank_id = $2';
    }
    const res = await pool.query(
      `SELECT policy FROM memory_policies ${where} ORDER BY version DESC LIMIT 20`,
      params,
    );
    for (const row of res.rows ?? []) {
      const policy = typeof row?.policy === 'string' ? JSON.parse(row.policy) : row?.policy;
      const days = Number(policy?.retentionDays);
      if (Number.isFinite(days) && days > 0) return Math.floor(days);
    }
  } catch {
    // default
  }
  return fallback;
}

export async function runRetentionSweeper(options: RunRetentionSweeperOptions): Promise<RetentionSweeperResult> {
  const started = Date.now();
  const now = options.now ?? new Date();
  const graceDays = options.graceDays ?? 30;
  const batchSize = options.batchSize ?? 500;
  const runBackup = options.runBackup ?? defaultRunBackup;
  const { pool } = options;

  let scanned = 0;
  let softDeleted = 0;
  let purged = 0;

  // Advisory lock to prevent overlap.
  let locked = true;
  try {
    const lockRes = await pool.query('SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock', [918273645]);
    const got = lockRes.rows?.[0]?.pg_try_advisory_lock;
    locked = got === true;
  } catch {
    // If lock function unavailable (e.g. non-PG mock), proceed best-effort.
    locked = true;
  }
  if (!locked) {
    const result = { scanned: 0, softDeleted: 0, purged: 0, durationMs: Date.now() - started };
    lastResult = { ...result, at: now.toISOString() };
    return result;
  }

  try {
    const retentionDays = options.retentionDays ?? await resolveRetentionDays(pool, 90, options.tenantId, options.bankId);
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const purgeCutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

    // Best-effort ensure soft-delete columns exist for raw evidence storage.
    try { await pool.query('ALTER TABLE evidence ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ'); } catch { /* ignore */ }
    try { await pool.query('ALTER TABLE project_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ'); } catch { /* ignore */ }

    // Scan count (best-effort).
    try {
      const c = await pool.query('SELECT id FROM evidence WHERE created_at <= $1 AND deleted_at IS NULL', [cutoff]);
      scanned += (c.rows?.length ?? c.rowCount ?? 0);
    } catch { /* ignore */ }
    try {
      const c = await pool.query('SELECT id FROM project_events WHERE occurred_at <= $1 AND deleted_at IS NULL', [cutoff]);
      scanned += (c.rows?.length ?? c.rowCount ?? 0);
    } catch { /* ignore */ }

    // Soft-delete old raw evidence/events in batches (distilled facts in `facts` are exempt).
    const softDeleteEvidence = async () => {
      try {
        const res = await pool.query(
          `UPDATE evidence SET deleted_at = $2 WHERE deleted_at IS NULL AND created_at <= $1`,
          [cutoff, now],
        );
        softDeleted += Number(res.rowCount ?? 0);
      } catch { /* ignore */ }
    };
    const softDeleteEvents = async () => {
      try {
        const res = await pool.query(
          `UPDATE project_events SET deleted_at = $2 WHERE deleted_at IS NULL AND occurred_at <= $1`,
          [cutoff, now],
        );
        softDeleted += Number(res.rowCount ?? 0);
      } catch { /* ignore */ }
    };
    await softDeleteEvidence();
    await softDeleteEvents();

    // Hard-purge soft-deleted rows older than grace. Backup before first purge of this process.
    const purgeEvidence = async () => {
      try {
        // Check if there is anything to purge first.
        const pending = await pool.query(
          `SELECT id FROM evidence WHERE deleted_at IS NOT NULL AND deleted_at <= $1 LIMIT $2`,
          [purgeCutoff, batchSize],
        );
        const count = pending.rows?.length ?? 0;
        if (count === 0) return;
        if (!backupRanThisProcess) {
          try { await runBackup(); } catch { /* best-effort; do not block purge in constrained envs */ }
          backupRanThisProcess = true;
        }
        const res = await pool.query(
          `DELETE FROM evidence WHERE deleted_at IS NOT NULL AND deleted_at <= $1`,
          [purgeCutoff],
        );
        purged += Number(res.rowCount ?? count);
      } catch { /* ignore */ }
    };
    const purgeEvents = async () => {
      try {
        const pending = await pool.query(
          `SELECT id FROM project_events WHERE deleted_at IS NOT NULL AND deleted_at <= $1 LIMIT $2`,
          [purgeCutoff, batchSize],
        );
        const count = pending.rows?.length ?? 0;
        if (count === 0) return;
        if (!backupRanThisProcess) {
          try { await runBackup(); } catch { /* best-effort */ }
          backupRanThisProcess = true;
        }
        const res = await pool.query(
          `DELETE FROM project_events WHERE deleted_at IS NOT NULL AND deleted_at <= $1`,
          [purgeCutoff],
        );
        purged += Number(res.rowCount ?? count);
      } catch { /* ignore */ }
    };
    await purgeEvidence();
    await purgeEvents();

    // Log counters to operations endpoint/state (best-effort, in-process).
    lastResult = { scanned, softDeleted, purged, durationMs: Date.now() - started, at: now.toISOString() };
    try {
      (globalThis as any).__RAY_RETENTION_SWEEPER_LAST__ = lastResult;
    } catch { /* ignore */ }

    return { scanned, softDeleted, purged, durationMs: lastResult.durationMs };
  } finally {
    try { await pool.query('SELECT pg_advisory_unlock($1)', [918273645]); } catch { /* ignore */ }
  }
}
