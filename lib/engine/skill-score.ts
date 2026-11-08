import type { DecisionTrace } from "./decision-trace";

export interface WhyScore {
  acceptance: number;
  samples: number;
}

export const MIN_SAMPLES = 5;
export const PROMOTE_AT = 0.7;

export function scoreSkills(traces: DecisionTrace[]): Record<string, WhyScore> {
  const acc = new Map<string, number>();
  const total = new Map<string, number>();
  for (const t of traces) {
    if (t.outcome !== "accepted" && t.outcome !== "edited" && t.outcome !== "reverted") continue;
    for (const item of t.items) {
      for (const tag of item.why.split(",")) {
        const w = tag.trim();
        if (!w) continue;
        total.set(w, (total.get(w) ?? 0) + 1);
        if (t.outcome === "accepted") acc.set(w, (acc.get(w) ?? 0) + 1);
      }
    }
  }
  const out: Record<string, WhyScore> = {};
  for (const [w, n] of total) {
    out[w] = { acceptance: (acc.get(w) ?? 0) / n, samples: n };
  }
  return out;
}

export function applySkillWeights(
  scores: Record<string, WhyScore>,
  current: Record<string, number>
): Record<string, number> {
  const next = { ...current };
  for (const [w, s] of Object.entries(scores)) {
    if (s.samples < MIN_SAMPLES) continue;
    if (s.acceptance >= PROMOTE_AT) next[w] = 1 + s.acceptance * 0.5;
    else if (s.acceptance <= 1 - PROMOTE_AT) next[w] = Math.max(0.25, 1 - (1 - s.acceptance) * 0.5);
  }
  return next;
}
