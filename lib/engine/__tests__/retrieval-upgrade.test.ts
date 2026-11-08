import { describe, expect, it } from "vitest";
import { rankFacts } from "../context-pack";

describe("retrieval upgrade", () => {
  it("graph neighbour outranks equal-score non-neighbour", () => {
    const ranked = rankFacts("AuthService login", [
      { entity: "Helper", category: "workflow", content: "AuthService login helper notes", confidence: 0.6, importance: 50, occurrences: 1 },
      { entity: "Target", category: "workflow", content: "AuthService login target notes", confidence: 0.6, importance: 50, occurrences: 1 },
    ], { links: [{ from: "AuthService", to: "Target" }] } as any);
    expect(ranked[0].entity).toBe("Target");
  });

  it("semantic fallback matches wording mismatch", () => {
    const ranked = rankFacts("sign-in hangs", [
      { entity: "readme", category: "workflow", content: "unrelated gardening notes about soil", confidence: 0.3, importance: 10, occurrences: 1 },
      { entity: "AuthService", category: "workflow", content: "login authentication timeout handling", confidence: 0.8, importance: 70, occurrences: 1 },
    ]);
    expect(ranked[0].entity).toBe("AuthService");
  });
});
