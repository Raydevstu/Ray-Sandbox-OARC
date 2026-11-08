import type { ContextPack } from "./context-pack";
import { tokenize } from "./nlp";

export interface TraceItem {
  entity: string;
  score: number;
  why: string;
  contentHash: string;
  contentLength: number;
}

export interface DecisionTrace {
  id: string;
  queryHash: string;
  task: string;
  model: string;
  tokens: number;
  items: TraceItem[];
  outcome?: "accepted" | "edited" | "reverted";
  createdAt: number;
}

export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function whyFor(query: string, content: string, entity: string, importance: number): { why: string; score: number } {
  const q = new Set(tokenize(query));
  const c = new Set(tokenize(content));
  let overlap = 0;
  for (const t of c) if (q.has(t)) overlap++;
  const eToks = tokenize(entity);
  const entityHit = eToks.some((t) => q.has(t));
  const reasons: string[] = [];
  if (overlap > 0) reasons.push(`keyword+${overlap}`);
  if (entityHit) reasons.push("entity");
  if (importance >= 80) reasons.push("importance");
  else if (importance >= 50) reasons.push("importance-mid");
  if (reasons.length === 0) reasons.push("semantic");
  const score = overlap * 3 + (entityHit ? 2 : 0) + importance / 25;
  return { why: reasons.join(","), score: Math.round(score * 100) / 100 };
}

export function recordTrace(input: {
  query: string;
  task: string;
  pack: ContextPack;
  model: string;
  tokens: number;
}): DecisionTrace {
  const items: TraceItem[] = input.pack.facts.map((f) => {
    const { why, score } = whyFor(input.query, f.content, f.entity, f.importance ?? 0);
    return {
      entity: f.entity,
      score,
      why,
      contentHash: fnv1a(f.content),
      contentLength: f.content.length,
    };
  });
  return {
    id: `trace-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    queryHash: fnv1a(input.query),
    task: input.task,
    model: input.model,
    tokens: input.tokens,
    items,
    createdAt: Date.now(),
  };
}

export function scoreAcceptance(traces: Pick<DecisionTrace, "outcome">[]): number {
  const decided = traces.filter((t) => t.outcome === "accepted" || t.outcome === "edited" || t.outcome === "reverted");
  if (decided.length === 0) return 0;
  const acc = decided.filter((t) => t.outcome === "accepted").length;
  return acc / decided.length;
}
