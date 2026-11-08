import { describe, expect, it } from "vitest";
import { supersedeFacts, decayScores, consolidateNightly } from "../memory-lifecycle";

describe("memory lifecycle", () => {
  it("supersedes contradicted fact and keeps newer", () => {
    const out = supersedeFacts([
      { entity: "AuthService", category: "workflow", content: "AuthService uses localStorage", confidence: 0.6, importance: 60, occurrences: 2 },
      { entity: "AuthService", category: "workflow", content: "AuthService uses httpOnly cookies, not localStorage", confidence: 0.9, importance: 85, occurrences: 1 },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].content).toMatch(/httpOnly/);
  });

  it("decay protects fresh high-importance", () => {
    const now = Date.now();
    const out = decayScores([
      { entity: "Auth", category: "workflow", content: "x", confidence: 0.9, importance: 95, occurrences: 5 },
    ], now);
    expect(out[0].importance).toBeGreaterThan(80);
  });

  it("nightly consolidation merges one domain", () => {
    const out = consolidateNightly([{ id: "1", task: "Fix login", filesTouched: ["AuthService.ts"], tests: [], findings: ["race"], resolution: "retry" }]);
    expect(out.length).toBe(1);
    expect((out[0] as any).provenance).toBeDefined();
  });
});
