import { countTokens } from "@/lib/utils";

export interface MemoryLayers {
  l0: string;
  l1: string;
  l2: string;
}

export interface LayeredFact {
  id: string;
  abstract?: string;
  overview?: string;
  detail?: string;
  text?: string;
}

export interface PackedLayer {
  factId: string;
  layer: "l0" | "l1" | "l2";
  text: string;
  tokens: number;
}

export function buildMemoryLayers(text: string): MemoryLayers {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const l0 = sentences[0] ?? normalized;
  const l1 = sentences.slice(0, 2).join(" ") || normalized;
  return { l0, l1, l2: normalized };
}

export function packLayeredFacts(facts: LayeredFact[], maxTokens: number): { layers: PackedLayer[]; tokensUsed: number } {
  const result: PackedLayer[] = [];
  let tokensUsed = 0;
  for (const fact of facts) {
    const candidates: Array<PackedLayer> = [
      { factId: fact.id, layer: "l0", text: fact.abstract ?? fact.text ?? "", tokens: countTokens(fact.abstract ?? fact.text ?? "") },
      { factId: fact.id, layer: "l1", text: fact.overview ?? fact.abstract ?? fact.text ?? "", tokens: countTokens(fact.overview ?? fact.abstract ?? fact.text ?? "") },
      { factId: fact.id, layer: "l2", text: fact.detail ?? fact.text ?? "", tokens: countTokens(fact.detail ?? fact.text ?? "") },
    ];
    const chosen = candidates.find((candidate) => candidate.text && tokensUsed + candidate.tokens <= maxTokens);
    if (!chosen) continue;
    result.push(chosen);
    tokensUsed += chosen.tokens;
  }
  return { layers: result, tokensUsed };
}
