import { rankFacts } from "../engine/context-pack";
import type { DistilledFact } from "../engine/distillation";

export function rankBankFacts(query: string, rows: DistilledFact[], limit: number): DistilledFact[] {
  if (!rows || rows.length === 0) return [];
  const q = String(query ?? "");
  if (!q.trim()) return rows.slice(0, Math.max(0, limit));
  return rankFacts(q, rows).slice(0, Math.max(0, limit));
}
