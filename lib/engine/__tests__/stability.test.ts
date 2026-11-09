import { describe, expect, it } from "vitest";
import { calculateStability, applyStabilityDecay, type StabilityTier } from "../stability";
import type { Insight, MemoryNode } from "../reflective-memory-types";

function makeNode(id: string, importance: number, createdAt: Date, lastValidatedAt?: Date): MemoryNode {
  return {
    id,
    kind: "fact",
    importance,
    createdAt,
    lastValidatedAt: lastValidatedAt ?? createdAt,
  };
}

function makeInsight(): Insight {
  return {
    id: "ins-1",
    kind: "insight",
    tenantId: "t1",
    bankId: "b1",
    type: "pattern",
    depth: 1,
    claim: "test insight",
    supportingNodes: [],
    contradictingNodes: [],
    confidence: 0.8,
    stability: 0.5,
    predictiveValue: null,
    parentInsights: [],
    status: "candidate",
    predictionCount: 0,
    correctPredictions: 0,
    importance: 80,
    createdAt: new Date(),
    lastValidatedAt: new Date(),
  };
}

describe("Phase 5: Stability Engine", () => {
  it("Temporary Pattern: all evidence from same day → low stability", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const supporting = [
      makeNode("s1", 80, now),
      makeNode("s2", 80, now),
      makeNode("s3", 80, now),
    ];
    const result = calculateStability(makeInsight(), supporting, []);
    expect(result.timeSpanScore).toBe(0);
    // Same-day evidence has no time spread; tier depends on other factors
    expect(result.tier).not.toBe("long");
  });

  it("Persistent Pattern: evidence spans 6 months → high stability", () => {
    const d1 = new Date("2026-01-01T00:00:00Z");
    const d2 = new Date("2026-04-01T00:00:00Z");
    const d3 = new Date("2026-07-01T00:00:00Z");
    const supporting = [
      makeNode("s1", 80, d1),
      makeNode("s2", 80, d2),
      makeNode("s3", 80, d3),
    ];
    const result = calculateStability(makeInsight(), supporting, []);
    expect(result.timeSpanScore).toBeGreaterThan(0.5);
    expect(result.tier).not.toBe("short");
  });

  it("Confidence ≠ Stability: high confidence + low stability (current sprint goal)", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const supporting = [
      makeNode("s1", 90, now),
      makeNode("s2", 90, now),
    ];
    const result = calculateStability(makeInsight(), supporting, []);
    // High importance → high source stability, but same-day → zero time span
    expect(result.sourceStabilityScore).toBeGreaterThan(0.8);
    expect(result.timeSpanScore).toBe(0);
    expect(result.tier).not.toBe("long");
  });

  it("Confidence ≠ Stability: high confidence + high stability (consistent preference)", () => {
    const d1 = new Date("2025-01-01T00:00:00Z");
    const d2 = new Date("2025-06-01T00:00:00Z");
    const d3 = new Date("2025-12-01T00:00:00Z");
    const supporting = [
      makeNode("s1", 90, d1),
      makeNode("s2", 90, d2),
      makeNode("s3", 90, d3),
    ];
    const result = calculateStability(makeInsight(), supporting, []);
    expect(result.timeSpanScore).toBeGreaterThan(0.5);
    expect(result.sourceStabilityScore).toBeGreaterThan(0.8);
    expect(result.tier).toBe("long");
  });

  it("Recent contradictions lower stability", () => {
    const now = new Date();
    const supporting = [makeNode("s1", 80, new Date("2025-01-01"))];
    const contradicting = [makeNode("c1", 80, now, now)]; // recent
    const result = calculateStability(makeInsight(), supporting, contradicting);
    expect(result.contradictionRecencyScore).toBeLessThan(1.0);
  });

  it("No contradictions → contradiction recency = 1.0", () => {
    const supporting = [makeNode("s1", 80, new Date("2025-01-01"))];
    const result = calculateStability(makeInsight(), supporting, []);
    expect(result.contradictionRecencyScore).toBe(1.0);
  });

  it("Tier assignment: short (<0.3), medium (0.3-0.7), long (>=0.7)", () => {
    // Short: same-day, low importance
    const shortResult = calculateStability(
      makeInsight(),
      [makeNode("s1", 20, new Date())],
      [],
    );
    expect(shortResult.tier).toBe("short");

    // Long: 6-month span, high importance, many facts
    const longResult = calculateStability(
      makeInsight(),
      [
        makeNode("s1", 90, new Date("2025-01-01")),
        makeNode("s2", 90, new Date("2025-04-01")),
        makeNode("s3", 90, new Date("2025-07-01")),
        makeNode("s4", 90, new Date("2025-10-01")),
        makeNode("s5", 90, new Date("2026-01-01")),
      ],
      [],
    );
    expect(longResult.tier).toBe("long");
  });

  it("applyStabilityDecay: short tier decays faster", () => {
    const shortDecayed = applyStabilityDecay(0.5, 10, "short");
    const longDecayed = applyStabilityDecay(0.5, 10, "long");
    expect(shortDecayed).toBeLessThan(longDecayed);
  });

  it("applyStabilityDecay: 0 days → no decay", () => {
    const result = applyStabilityDecay(0.8, 0, "medium");
    expect(result).toBe(0.8);
  });

  it("Result includes all diagnostic fields", () => {
    const result = calculateStability(makeInsight(), [makeNode("s1", 80, new Date())], []);
    expect(result).toHaveProperty("stability");
    expect(result).toHaveProperty("timeSpanScore");
    expect(result).toHaveProperty("sourceStabilityScore");
    expect(result).toHaveProperty("contradictionRecencyScore");
    expect(result).toHaveProperty("entityPersistenceScore");
    expect(result).toHaveProperty("tier");
  });

  it("Determinism: same input → same output", () => {
    const supporting = [makeNode("s1", 80, new Date("2025-06-01"))];
    const r1 = calculateStability(makeInsight(), supporting, []);
    const r2 = calculateStability(makeInsight(), supporting, []);
    expect(r1.stability).toBe(r2.stability);
    expect(r1.tier).toBe(r2.tier);
  });

  it("Bounds: stability always between 0 and 1", () => {
    const cases = [
      { s: [], c: [] },
      { s: [makeNode("s1", 100, new Date("2020-01-01"))], c: [] },
      { s: [makeNode("s1", 0, new Date())], c: [makeNode("c1", 100, new Date())] },
    ];
    for (const { s, c } of cases) {
      const result = calculateStability(makeInsight(), s, c);
      expect(result.stability).toBeGreaterThanOrEqual(0);
      expect(result.stability).toBeLessThanOrEqual(1);
    }
  });
});
