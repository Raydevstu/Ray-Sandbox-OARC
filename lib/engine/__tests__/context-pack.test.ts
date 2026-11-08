import { describe, expect, it } from "vitest";
import { buildContextPack, rankFacts } from "../context-pack";

describe("context pack", () => {
  it('builds capped pack with relevant facts first', () => {
    const pack = buildContextPack({ task: "Fix login timeout", query: "login timeout",
      facts: [
        { entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh tokens", confidence: 0.9, importance: 95, occurrences: 3 },
        { entity: "readme", category: "workflow", content: "unrelated notes", confidence: 0.3, importance: 12, occurrences: 1 },
      ], investigations: [], maxTokens: 1500 });
    expect(pack.task).toBe("Fix login timeout");
    expect(pack.facts[0].entity).toBe("AuthService");
    expect(pack.tokensUsed).toBeLessThanOrEqual(1500);
  });

  it('ranks entity matches above noise', () => {
    const ranked = rankFacts("token refresh", [
      { entity: "readme", category: "workflow", content: "hello world notes", confidence: 0.3, importance: 10, occurrences: 1 },
      { entity: "TokenService", category: "workflow", content: "TokenService handles token refresh flow", confidence: 0.9, importance: 90, occurrences: 2 },
    ]);
    expect(ranked[0].entity).toBe("TokenService");
  });

  it('hard-caps at maxTokens', () => {
    const big = Array.from({ length: 30 }, (_, i) => ({
      entity: "AuthService", category: "workflow" as const,
      content: "AuthService manages JWT refresh tokens for login session handling ".repeat(20) + i,
      confidence: 0.9, importance: 90, occurrences: 2,
    }));
    const pack = buildContextPack({ task: "t", query: "login", facts: big, maxTokens: 1500 });
    expect(pack.tokensUsed).toBeLessThanOrEqual(1500);
    expect(pack.facts.length).toBeLessThan(30);
  });
});
