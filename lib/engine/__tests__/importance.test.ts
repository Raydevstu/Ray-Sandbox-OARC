import { describe, expect, it } from "vitest";
import { calculateImportance, mergeDuplicates, applyAging } from "../importance";

describe("importance scoring", () => {
  it('scores AuthService fact high and README low', () => {
    const high = calculateImportance({ entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh", confidence: 0.9, importance: 0, occurrences: 3 });
    const low = calculateImportance({ entity: "readme", category: "workflow", content: "README title", confidence: 0.3, importance: 0, occurrences: 1 });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });

  it('merges duplicate JWT refresh facts', () => {
    const merged = mergeDuplicates([
      { entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh", confidence: 0.9, importance: 90, occurrences: 1 },
      { entity: "AuthService", category: "workflow", content: "JWT refresh handled in AuthService", confidence: 0.8, importance: 85, occurrences: 1 },
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0].occurrences).toBe(2);
  });

  it('does not merge unrelated entities', () => {
    const merged = mergeDuplicates([
      { entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh tokens", confidence: 0.9, importance: 90, occurrences: 1 },
      { entity: "Payments", category: "workflow", content: "Payments handles stripe webhooks", confidence: 0.9, importance: 90, occurrences: 1 },
    ]);
    expect(merged.length).toBe(2);
  });

  it('ages out low-importance singletons', () => {
    const kept = applyAging([
      { entity: "readme", category: "workflow", content: "x", confidence: 0.2, importance: 8, occurrences: 1 },
      { entity: "AuthService", category: "workflow", content: "AuthService manages JWT refresh", confidence: 0.9, importance: 95, occurrences: 5 },
    ]);
    expect(kept.some((f) => f.entity === "AuthService")).toBe(true);
  });

  it('never returns NaN', () => {
    expect(Number.isNaN(calculateImportance({ entity: "", category: "workflow", content: "", confidence: NaN as any, importance: 0, occurrences: 0 }))).toBe(false);
  });
});
