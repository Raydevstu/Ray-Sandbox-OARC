import { posix } from "path";
import { getPgPool } from "./pg-client";
import { importOnce } from "./import-worker";

export const PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? "/projects";
const STATE_KEY = "watcher-loop";

type LoopState = {
  running: boolean;
  timer?: ReturnType<typeof setInterval>;
  lastRun: number;
  lastResult: Record<string, { scanned: number; imported: number }>;
};

const state: LoopState = { running: false, lastRun: 0, lastResult: {} };

export function resolveWatchPath(root: string, input: string): string | null {
  const trimmed = input.trim().replace(/\\/g, "/");
  if (!trimmed) return null;
  const normRoot = root.replace(/\\/g, "/").replace(/\/$/, "");
  const abs = trimmed.startsWith("/") ? posix.normalize(trimmed) : posix.normalize(normRoot + "/" + trimmed);
  if (abs !== normRoot && !abs.startsWith(normRoot + "/")) return null;
  return abs;
}

export function listWatchTargets(
  root: string,
  banks: { bankId: string; path: string }[]
): { bankId: string; dir: string }[] {
  const out: { bankId: string; dir: string }[] = [];
  for (const b of banks) {
    const dir = resolveWatchPath(root, b.path);
    if (dir) out.push({ bankId: b.bankId, dir });
  }
  return out;
}

async function tick(): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT bank_id, content AS path FROM evidence WHERE source = 'bank-watch-path'`
    ).catch(() => ({ rows: [] as any[] }));
    const seen = new Map<string, string>();
    for (const r of rows as any[]) {
      const bankId = String((r as any).bank_id);
      if (!seen.has(bankId)) seen.set(bankId, String((r as any).path ?? ""));
    }
    const targets = listWatchTargets(PROJECTS_ROOT, [...seen].map(([bankId, path]) => ({ bankId, path })));
    const result: Record<string, { scanned: number; imported: number }> = {};
    for (const t of targets) {
      try {
        const out = await importOnce(pool as any, "sandbox-tenant", t.bankId, t.dir, []);
        result[t.bankId] = { scanned: out.scanned, imported: out.imported };
      } catch (e) {
        console.warn(`watcher loop import failed for ${t.bankId}:`, e);
      }
    }
    state.lastRun = Date.now();
    state.lastResult = result;
  } catch (e) {
    console.warn("watcher loop tick failed:", e);
  }
}

export function startWatcherLoop(intervalMs = 60_000): () => void {
  if (state.running) return stopWatcherLoop;
  state.running = true;
  void tick();
  state.timer = setInterval(() => void tick(), intervalMs);
  if (typeof (state.timer as any).unref === "function") (state.timer as any).unref();
  return stopWatcherLoop;
}

export function stopWatcherLoop(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = undefined;
  state.running = false;
}

export function watcherStatus(): { running: boolean; lastRun: number; lastResult: Record<string, { scanned: number; imported: number }> } {
  return { running: state.running, lastRun: state.lastRun, lastResult: state.lastResult };
}

export { STATE_KEY };
