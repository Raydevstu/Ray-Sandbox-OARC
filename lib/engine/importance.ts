import type { DistilledFact } from "./distillation";
import { tokenize } from "./nlp";

function safeNum(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : fallback;
  return Number.isFinite(v) ? v : fallback;
}

export function calculateImportance(
  f: Pick<DistilledFact, "entity" | "content" | "confidence" | "occurrences" | "category"> & { importance?: number },
  ctx?: { recencyBoost?: number }
): number {
  if (!f.content || !f.content.trim()) return 5;
  const entity = (f.entity ?? "").trim() || "general";
  const conf = safeNum(f.confidence, 0.5);
  const occ = Math.max(0, Math.floor(safeNum(f.occurrences, 1)));
  const catWeight =
    f.category === "failure" ? 34
    : f.category === "solution" ? 32
    : f.category === "decision" ? 32
    : f.category === "success" ? 32
    : f.category === "architecture" ? 30
    : f.category === "goal" ? 28
    : f.category === "implementation" ? 28
    : f.category === "progress" ? 24
    : 22;
  const architectureImpact = Math.min(40, catWeight + Math.min(10, Math.floor(entity.length / 2)));
  const dependencyImpact = Math.min(25, occ * 8);
  const taskFrequency = Math.min(20, occ * 6);
  const recency = Math.max(0, Math.min(10, safeNum(ctx?.recencyBoost, 8)));
  const confPart = Math.max(0, Math.min(10, Math.round(conf * 10)));
  const total = architectureImpact + dependencyImpact + taskFrequency + recency + confPart;
  if (!Number.isFinite(total)) return 5;
  return Math.max(0, Math.min(100, Math.round(total)));
}

function normalize(text: string): string[] {
  return tokenize(text);
}

function overlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hit = 0;
  for (const t of new Set(a)) if (setB.has(t)) hit++;
  return hit / Math.max(new Set(a).size, new Set(b).size);
}

export function mergeDuplicates(facts: DistilledFact[]): DistilledFact[] {
  const out: DistilledFact[] = [];
  for (const f of facts) {
    const fTokens = normalize(`${f.entity} ${f.content}`);
    let merged = false;
    for (const o of out) {
      if (o.entity.toLowerCase() !== f.entity.toLowerCase()) continue;
      if (o.category !== f.category) continue;
      const oTokens = normalize(`${o.entity} ${o.content}`);
      if (overlap(fTokens, oTokens) >= 0.5) {
        o.occurrences += f.occurrences;
        if (f.importance > o.importance) o.importance = f.importance;
        if (f.content.length > o.content.length) o.content = f.content;
        o.confidence = Math.max(o.confidence, f.confidence);
        merged = true;
        break;
      }
    }
    if (!merged) out.push({ ...f });
  }
  return out;
}

export function applyAging(facts: DistilledFact[], nowMs = Date.now()): DistilledFact[] {
  void nowMs;
  return facts
    .map((f) => {
      const recencyFactor = 1.0;
      const effective = f.importance * (1 + Math.log10(1 + f.occurrences)) * recencyFactor;
      return { f, effective };
    })
    .filter(({ f, effective }) => {
      if (f.importance < 15 && f.occurrences <= 1) return false;
      return effective > 0;
    })
    .sort((a, b) => b.effective - a.effective)
    .map(({ f }) => f);
}
