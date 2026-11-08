import { describe, expect, it } from "vitest";
import { recall } from "../recall";

const SETTINGS: any = { budgetMode: "fixed", budget: "mid", maxTokens: 1000, types: [], includeExpired: true,
  recencyAlpha: 0, temporalAlpha: 0, proofAlpha: 0, entityBoostAlpha: 0, rrfK: 60, rerankerCap: 10,
  rerankEnabled: false, includeChunks: false, maxChunkTokens: 200,
  boosts: { semantic: 1, bm25: 1, graph: 1, temporal: 1 }, dedupThreshold: 0.9,
  autoConsolidation: false, observationsMission: "", consolidationStrategies: "" };

describe("fusion wire", () => {
  it('recall still works when distilled pack passed alongside', async () => {
    const res: any = await recall({ query: "login timeout", facts: [], links: [], observations: [], opinions: [],
      settings: SETTINGS, distilledFacts: [] } as any);
    expect(res).toBeDefined();
  });

  it('recall attaches contextPack when distilledFacts present', async () => {
    const res: any = await recall({ query: "login timeout",
      facts: [{ id: "f1", bankId: "b1", text: "AuthService manages JWT refresh", network: "world", entities: ["AuthService"], mentionedAt: new Date().toISOString(), tokens: 10, tags: [], accessCount: 0, causal: [] }],
      links: [], observations: [], opinions: [],
      settings: SETTINGS,
      distilledFacts: [{ entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh tokens", confidence: 0.9, importance: 95, occurrences: 3 }] } as any);
    expect(res).toBeDefined();
    expect((res as any).contextPack).toBeDefined();
    expect((res as any).contextPack.facts[0].entity).toBe("AuthService");
  });
});
