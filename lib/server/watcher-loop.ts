import { posix } from "path";
import { getPgPool } from "./pg-client";
import { importOnce } from "./import-worker";
import { normalizeCwd } from "./hermes-sessions";
import { readHermesSessions, readSessionMessages, hermesDbPath } from "./hermes-store";
import { syncBankFromSessions } from "./hermes-sync";
import { saveDistilledFacts } from "./pg-lifecycle";

export const PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? "/projects";
const STATE_KEY = "watcher-loop";

type LoopState = {
  running: boolean;
  timer?: ReturnType<typeof setInterval>;
  lastRun: number;
  lastResult: Record<string, { scanned: number; imported: number; sessions?: number; chatMessages?: number }>;
  cursors: Map<string, number>;
};

const state: LoopState = { running: false, lastRun: 0, lastResult: {}, cursors: new Map() };

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
  banks: { bankId: string; path: string; cwd?: string }[]
): { bankId: string; dir: string; cwdKey: string | null }[] {
  const out: { bankId: string; dir: string; cwdKey: string | null }[] = [];
  for (const b of banks) {
    const dir = resolveWatchPath(root, b.path);
    if (dir) out.push({ bankId: b.bankId, dir, cwdKey: b.cwd ? normalizeCwd(b.cwd) : null });
  }
  return out;
}

async function tick(): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;
  try {
    const { rows } = await pool.query(
      `SELECT bank_id, content AS path, provenance FROM evidence WHERE source = 'bank-watch-path'`
    ).catch(() => ({ rows: [] as any[] }));
    const seen = new Map<string, { path: string; cwd: string }>();
    for (const r of rows as any[]) {
      const bankId = String((r as any).bank_id);
      if (!seen.has(bankId)) {
        let cwd = "";
        try { cwd = String(JSON.parse(String((r as any).provenance ?? "{}")).cwd ?? ""); } catch { cwd = ""; }
        seen.set(bankId, { path: String((r as any).path ?? (r as any).content ?? ""), cwd });
      }
    }
    const targets = listWatchTargets(PROJECTS_ROOT, [...seen].map(([bankId, v]) => ({ bankId, path: v.path, cwd: v.cwd })));
    const result: Record<string, { scanned: number; imported: number; sessions?: number; chatMessages?: number }> = {};
    const dbPath = hermesDbPath();
    const hermesSessions = dbPath ? readHermesSessions(dbPath) : [];
    for (const t of targets) {
      try {
        const out = await importOnce(pool as any, "sandbox-tenant", t.bankId, t.dir, []);
        const entry: { scanned: number; imported: number; sessions?: number; chatMessages?: number } = {
          scanned: out.scanned,
          imported: out.imported,
        };
        // Pull Hermes chats whose cwd matches this bank's recorded cwd.
        if (dbPath && hermesSessions.length > 0 && t.cwdKey) {
          const matching = hermesSessions.filter((s) => s.cwd && normalizeCwd(s.cwd) === t.cwdKey);
          if (matching.length > 0) {
            const report = await syncBankFromSessions({
              bankId: t.bankId,
              bankCwdKey: t.cwdKey,
              sessions: matching,
              readMessages: (id) => readSessionMessages(dbPath, id, 0, 500),
              getCursor: (_b, sid) => state.cursors.get(`${t.bankId}:${sid}`) ?? 0,
              setCursor: (_b, sid, ts) => { state.cursors.set(`${t.bankId}:${sid}`, ts); },
              saveFacts: async (facts) => { await saveDistilledFacts(pool as any, "sandbox-tenant", t.bankId, facts); },
            });
            entry.sessions = report.sessionsMatched;
            entry.chatMessages = report.messagesImported;
            entry.imported += report.messagesImported > 0 ? 1 : 0;
          }
        }
        result[t.bankId] = entry;
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

export function watcherStatus(): { running: boolean; lastRun: number; hermesDb: boolean; lastResult: Record<string, { scanned: number; imported: number; sessions?: number; chatMessages?: number }> } {
  return { running: state.running, lastRun: state.lastRun, hermesDb: hermesDbPath() !== null, lastResult: state.lastResult };
}

export { STATE_KEY };
