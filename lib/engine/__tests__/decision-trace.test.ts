import { describe, expect, it } from "vitest";
import { recordTrace, scoreAcceptance } from "../decision-trace";

describe("decision trace", () => {
  it("trace keeps per-item reasons without raw PII", () => {
    const t = recordTrace({ query: "fix login", task: "fix login",
      pack: { task: "fix login", architectureFacts: [], previousSolutions: [], relevantFiles: [], dependencies: [], risks: [], facts: [
        { entity: "AuthService", category: "workflow", content: "secret abc", confidence: 0.9, importance: 95, occurrences: 1 },
      ], tokensUsed: 10 }, model: "local", tokens: 10 });
    expect(t.items[0].why).toMatch(/keyword|entity|importance|graph|semantic/);
    expect(JSON.stringify(t)).not.toMatch(/secret abc/);
  });

  it("acceptance score counts unedited accepts", () => {
    expect(scoreAcceptance([{ outcome: "accepted" }, { outcome: "edited" }, { outcome: "accepted" }] as any)).toBeCloseTo(0.66, 1);
  });
});
