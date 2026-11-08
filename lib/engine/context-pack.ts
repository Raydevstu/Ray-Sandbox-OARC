import type { DistilledFact } from "./distillation";
import type { Investigation } from "./investigations";
import { tokenize, embed, cosine } from "./nlp";

export interface RankedFact extends DistilledFact {
  score: number;
}

export interface ContextPack {
  task: string;
  architectureFacts: string[];
  previousSolutions: string[];
  relevantFiles: string[];
  dependencies: string[];
  risks: string[];
  facts: DistilledFact[];
  tokensUsed: number;
}

export function countTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function entityTokens(entity: string): string[] {
  return tokenize(entity);
}

export interface RankOpts {
  links?: { from: string; to: string }[];
  entities?: { name: string; cooccur?: { entity: string }[] }[];
  semanticWeight?: number;
}

export function rankFacts(query: string, facts: DistilledFact[], opts?: RankOpts): DistilledFact[] {
  const qTokens = new Set(tokenize(query));
  const linkAdj = new Map<string, Set<string>>();
  for (const l of opts?.links ?? []) {
    const a = (l.from || "").toLowerCase();
    const b = (l.to || "").toLowerCase();
    if (!a || !b) continue;
    if (!linkAdj.has(a)) linkAdj.set(a, new Set());
    if (!linkAdj.has(b)) linkAdj.set(b, new Set());
    linkAdj.get(a)!.add(b);
    linkAdj.get(b)!.add(a);
  }
  const directHits = new Set<string>();
  for (const f of facts) {
    const cTokens = new Set(tokenize(f.content));
    let hit = false;
    for (const t of cTokens) if (qTokens.has(t)) { hit = true; break; }
    const eToks = entityTokens(f.entity);
    for (const t of eToks) if (qTokens.has(t)) hit = true;
    if (hit) directHits.add(f.entity.toLowerCase());
  }
  for (const t of qTokens) directHits.add(t);
  const neighbourSet = new Set<string>();
  for (const d of directHits) {
    const nbs = linkAdj.get(d);
    if (!nbs) continue;
    let added = 0;
    for (const n of nbs) {
      if (added >= 3) break;
      neighbourSet.add(n);
      added++;
    }
  }
  let qVec: Float32Array | null = null;
  try {
    qVec = embed(query);
  } catch {
    qVec = null;
  }
  const semanticWeight = opts?.semanticWeight ?? 1.5;
  const scored = facts.map((f) => {
    const cTokens = new Set(tokenize(f.content));
    let overlap = 0;
    for (const t of cTokens) if (qTokens.has(t)) overlap++;
    const eToks = entityTokens(f.entity);
    let entityMatch = 0;
    for (const t of eToks) if (qTokens.has(t)) entityMatch = 1;
    for (const t of cTokens) {
      if (eToks.includes(t) && qTokens.has(t)) entityMatch = 1;
    }
    let graphBoost = 0;
    if (neighbourSet.has(f.entity.toLowerCase())) graphBoost = 2.5;
    let semanticBoost = 0;
    if (overlap === 0 && qVec) {
      try {
        const c = cosine(qVec, embed(f.content));
        if (Number.isFinite(c) && c > 0) semanticBoost = c * semanticWeight;
      } catch {
        semanticBoost = 0;
      }
    }
    const score = overlap * 3 + entityMatch * 2 + (f.importance ?? 0) / 25 + (f.confidence ?? 0) + graphBoost + semanticBoost;
    return { f, score };
  });
  return scored.sort((a, b) => b.score - a.score).map((s) => s.f);
}

const FILE_RE = /[\w\-./\\]+\.(ts|tsx|js|jsx|py|go|rs|java|md|json)/g;

function extractFiles(content: string): string[] {
  const m = content.match(FILE_RE);
  return m ? [...new Set(m)] : [];
}

export function buildContextPack(input: {
  task: string;
  query: string;
  facts: DistilledFact[];
  investigations?: Investigation[];
  entities?: { name: string; cooccur: { entity: string }[] }[];
  maxTokens?: number;
}): ContextPack {
  const maxTokens = input.maxTokens ?? 1500;
  const ranked = rankFacts(input.query, input.facts).slice(0, 15);
  const packed: DistilledFact[] = [];
  let tokensUsed = 0;
  for (const f of ranked) {
    const t = countTokens(f.content);
    if (tokensUsed + t > maxTokens) continue;
    packed.push(f);
    tokensUsed += t;
  }
  const architectureFacts = packed
    .filter((f) => f.category === "architecture" || f.category === "workflow" || f.category === "dependency")
    .map((f) => f.content);
  const previousSolutions = packed.filter((f) => f.category === "solution").map((f) => f.content);
  const risks = packed.filter((f) => f.category === "risk" || f.category === "failure").map((f) => f.content);
  const fileSet = new Set<string>();
  for (const f of packed) for (const file of extractFiles(f.content)) fileSet.add(file);
  if (packed.length === 0) {
    for (const f of input.facts.slice(0, 3)) for (const file of extractFiles(f.content)) fileSet.add(file);
  }
  const relevantFiles = [...fileSet].length > 0 ? [...fileSet] : packed.map((f) => f.entity);
  const depSet = new Set<string>();
  if (input.entities) {
    for (const e of input.entities) {
      if (packed.some((f) => f.entity.toLowerCase() === e.name.toLowerCase())) {
        for (const c of e.cooccur ?? []) depSet.add(c.entity);
      }
    }
  }
  return {
    task: input.task,
    architectureFacts,
    previousSolutions,
    relevantFiles,
    dependencies: [...depSet],
    risks,
    facts: packed,
    tokensUsed,
  };
}
