// lib/engine/temporal-version.ts
import type { MemoryFact } from "@/lib/types";

export function preferLatestVersion(facts: MemoryFact[]): MemoryFact[] {
  // Group facts by primary entity
  const groups = new Map<string, MemoryFact[]>();
  for (const f of facts) {
    const key = f.entities[0] ?? f.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  const result: MemoryFact[] = [];
  for (const [, group] of groups) {
    if (group.length <= 1) {
      result.push(...group);
      continue;
    }
    // Sort by mentionedAt descending, mark latest
    const sorted = [...group].sort((a, b) =>
      b.mentionedAt.localeCompare(a.mentionedAt)
    );
    // Boost recency for the latest, penalize superseded
    for (let i = 0; i < sorted.length; i++) {
      const f = sorted[i];
      const isLatest = i === 0;
      (f as any).recencyBoost = isLatest ? 1.5 : 0.7;
    }
    result.push(...sorted);
  }
  return result;
}
