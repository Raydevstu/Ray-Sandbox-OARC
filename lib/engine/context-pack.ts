import type { DistilledFact } from "./distillation";
import type { Investigation } from "./investigations";
import { tokenize } from "./nlp";

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

export function rankFacts(query: string, facts: DistilledFact[]): DistilledFact[] {
  const qTokens = new Set(tokenize(query));
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
    const score = overlap * 3 + entityMatch * 2 + (f.importance ?? 0) / 25 + (f.confidence ?? 0);
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
