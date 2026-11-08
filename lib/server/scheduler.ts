import { loadDistilledFacts, saveDistilledFacts, type PgPool } from "./pg-lifecycle";
import { supersedeFacts, decayScores } from "../engine/memory-lifecycle";

export interface ConsolidationReport {
  bankId: string;
  before: number;
  after: number;
  removed: number;
  at: number;
}

export async function runConsolidationOnce(pool: PgPool, tenantId: string, bankId: string): Promise<ConsolidationReport> {
  const before = await loadDistilledFacts(pool, tenantId, bankId, 500);
  const afterSupersede = supersedeFacts(before);
  const afterDecay = decayScores(afterSupersede, Date.now());
  await saveDistilledFacts(pool, tenantId, bankId, afterDecay);
  return { bankId, before: before.length, after: afterDecay.length, removed: before.length - afterDecay.length, at: Date.now() };
}

export function scheduleNightly(job: () => void, intervalMs = 86_400_000): () => void {
  const timer = setInterval(() => {
    try {
      const r = job() as unknown;
      if (r && typeof (r as Promise<unknown>).catch === "function") {
        (r as Promise<unknown>).catch((e) => console.warn("nightly job failed:", e));
      }
    } catch (e) {
      console.warn("nightly job failed:", e);
    }
  }, intervalMs);
  if (typeof (timer as any).unref === "function") (timer as any).unref();
  return () => clearInterval(timer);
}

let booted = false;

export function bootNightlyScheduler(pool: PgPool, tenantId: string, bankId: string): void {
  if (booted) return;
  booted = true;
  if (process.env.APEX_NIGHTLY !== "true") return;
  const run = () => runConsolidationOnce(pool, tenantId, bankId).then(
    (r) => console.log(`nightly consolidation: ${r.before}→${r.after} (removed ${r.removed})`),
    (e) => console.warn("nightly consolidation failed:", e)
  );
  setTimeout(run, 60_000);
  scheduleNightly(run);
}
