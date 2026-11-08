import type { DistilledFact } from "./distillation";
import type { Investigation } from "./investigations";
import { tokenize } from "./nlp";

export interface Provenance {
  source: string;
  commit?: string;
  turnId?: string;
  createdAt: number;
}

export function withProvenance<T extends object>(
  fact: T,
  source: Omit<Provenance, "createdAt"> & { createdAt?: number }
): T & { provenance: Provenance } {
  return {
    ...fact,
    provenance: { createdAt: Date.now(), ...source, createdAt: source.createdAt ?? Date.now() },
  };
}

const CONTRADICTION_RE = /\b(not |no longer|instead|replaces?|migrated|deprecated|rather than|moved to)\b/i;

function tokens(text: string): Set<string> {
  return new Set(tokenize(text));
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / Math.max(a.size, b.size);
}

export function supersedeFacts(facts: DistilledFact[]): DistilledFact[] {
  const groups = new Map<string, DistilledFact[]>();
  for (const f of facts) {
    const key = (f.entity || "general").toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  const out: DistilledFact[] = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      out.push({ ...group[0] });
      continue;
    }
    const sorted = [...group].sort((a, b) => b.confidence - a.confidence);
    let winner = { ...sorted[0] };
    let mergedOcc = winner.occurrences;
    for (let i = 1; i < sorted.length; i++) {
      const cand = sorted[i];
      const ov = overlap(tokens(winner.content), tokens(cand.content));
      const contradicts =
        CONTRADICTION_RE.test(winner.content) || CONTRADICTION_RE.test(cand.content);
      const sameTopic = ov >= 0.4;
      if (contradicts || (sameTopic && winner.confidence - cand.confidence >= 0.2)) {
        mergedOcc += cand.occurrences;
        if (cand.importance > winner.importance && !contradicts) winner = { ...cand };
      } else if (sameTopic) {
        mergedOcc += cand.occurrences;
        if (cand.content.length > winner.content.length) winner = { ...winner, content: cand.content };
        winner.confidence = Math.max(winner.confidence, cand.confidence);
      } else {
        out.push({ ...cand });
      }
    }
    winner.occurrences = mergedOcc;
    out.push(winner);
  }
  return out;
}

export function decayScores(facts: DistilledFact[], nowMs = Date.now()): DistilledFact[] {
  return facts.map((f) => {
    const created = (f as any).provenance?.createdAt as number | undefined;
    const ageDays = created ? Math.max(0, (nowMs - created) / 86_400_000) : 0;
    const factor = 1 / (1 + ageDays / 30);
    const floor = f.importance >= 80 && f.occurrences >= 3 ? 80 : 10;
    const next = Math.max(floor, Math.round(f.importance * factor + f.occurrences * 2));
    return { ...f, importance: Math.max(0, Math.min(100, next)) };
  });
}

function domainOf(inv: Investigation): string {
  if (inv.filesTouched.length > 0) {
    const base = inv.filesTouched[0].split("/").pop() ?? inv.filesTouched[0];
    return base.replace(/\.(ts|tsx|js|jsx)$/i, "").toLowerCase();
  }
  const kw = tokenize(inv.task).find((t) => t.length > 3) ?? "general";
  return kw;
}

export function consolidateNightly(investigations: Investigation[]): (DistilledFact & { provenance: Provenance })[] {
  const groups = new Map<string, Investigation[]>();
  for (const inv of investigations) {
    const d = domainOf(inv);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(inv);
  }
  const out: (DistilledFact & { provenance: Provenance })[] = [];
  for (const [, invs] of groups) {
    const contents = invs.map((i) => {
      const parts = [i.task.trim()];
      if (i.filesTouched.length > 0) parts.push(`files: ${i.filesTouched.join(", ")}`);
      if (i.resolution) parts.push(`resolution: ${i.resolution}`);
      if (i.findings.length > 0) parts.push(`findings: ${i.findings.join("; ")}`);
      return parts.join(" — ");
    });
    const merged = contents.join(" | ").slice(0, 2000);
    const importance = Math.max(...invs.map((i) => (i.resolution ? 85 : 60)));
    const occurrences = invs.length;
    const first = invs[0];
    const entityBase = first.filesTouched[0]?.split("/").pop()?.replace(/\.(ts|tsx|js|jsx)$/i, "") ?? "general";
    out.push(
      withProvenance(
        {
          entity: entityBase,
          category: "workflow" as const,
          content: merged,
          confidence: first.resolution ? 0.85 : 0.6,
          importance,
          occurrences,
        },
        { source: "nightly", createdAt: Date.now() }
      )
    );
  }
  return out;
}
