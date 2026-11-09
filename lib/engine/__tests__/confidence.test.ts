import { describe, expect, it } from "vitest";
import { calculateConfidence, type ConfidenceNode } from "../confidence";

function node(id: string, importance: number): ConfidenceNode {
  return { id, importance };
}

describe("Phase 4: Confidence Engine", () => {
  it("Strong Consensus: 30 supporting, 1 contradicting → >0.9 confidence", () => {
    const supporting = Array.from({ length: 30 }, (_, i) => node(`s${i}`, 80));
    const contradicting = [node("c1", 80)];
    const result = calculateConfidence(supporting, contradicting);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });

  it("Small Sample: 3 supporting, 0 contradicting → ≈0.3 confidence (sample size factor limits)", () => {
    const supporting = [node("s1", 80), node("s2", 80), node("s3", 80)];
    const result = calculateConfidence(supporting, []);
    // evidenceStrength = 1.0, sampleSizeFactor = 3/10 = 0.3, raw = 0.3, floored to 0.3
    expect(result.confidence).toBeCloseTo(0.3, 1);
    expect(result.sampleSizeFactor).toBeCloseTo(0.3, 1);
  });

  it("Balanced Evidence: 5 supporting, 5 contradicting → low confidence (floor)", () => {
    const supporting = Array.from({ length: 5 }, (_, i) => node(`s${i}`, 80));
    const contradicting = Array.from({ length: 5 }, (_, i) => node(`c${i}`, 80));
    const result = calculateConfidence(supporting, contradicting);
    // evidenceStrength = (400-400)/800 = 0, clamped to 0, raw = 0, floored to 0.3
    expect(result.confidence).toBe(0.3);
    expect(result.evidenceStrength).toBe(0);
  });

  it("Contradiction Dominant: 2 supporting, 10 contradicting → floor value", () => {
    const supporting = [node("s1", 80), node("s2", 80)];
    const contradicting = Array.from({ length: 10 }, (_, i) => node(`c${i}`, 80));
    const result = calculateConfidence(supporting, contradicting);
    // rawStrength = (160-800)/960 = -0.667, clamped to 0, raw = 0, floored to 0.3
    expect(result.confidence).toBe(0.3);
  });

  it("Bounds: confidence always between 0.3 and 0.95", () => {
    // Test various random-ish combinations
    const cases = [
      { s: 1, c: 0 },
      { s: 5, c: 5 },
      { s: 10, c: 0 },
      { s: 0, c: 10 },
      { s: 100, c: 1 },
      { s: 1, c: 100 },
    ];
    for (const { s, c } of cases) {
      const supporting = Array.from({ length: s }, (_, i) => node(`s${i}`, 80));
      const contradicting = Array.from({ length: c }, (_, i) => node(`c${i}`, 80));
      const result = calculateConfidence(supporting, contradicting);
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    }
  });

  it("No evidence: 0 supporting, 0 contradicting → floor (0.3)", () => {
    const result = calculateConfidence([], []);
    expect(result.confidence).toBe(0.3);
    expect(result.totalEvidenceCount).toBe(0);
  });

  it("Saturation: 10+ facts saturates sample size factor at 1.0", () => {
    const supporting = Array.from({ length: 15 }, (_, i) => node(`s${i}`, 80));
    const result = calculateConfidence(supporting, []);
    expect(result.sampleSizeFactor).toBe(1.0);
  });

  it("Evidence strength uses importance weighting", () => {
    // High-importance supporting, low-importance contradicting
    const supporting = [node("s1", 100)];
    const contradicting = [node("c1", 10)];
    const result = calculateConfidence(supporting, contradicting);
    // supportingWeight=100, contradictingWeight=10, total=110
    // rawStrength = (100-10)/110 = 0.818, sampleSizeFactor = 2/10 = 0.2
    // raw = 0.818 * 0.2 = 0.164, floored to 0.3
    expect(result.supportingWeight).toBe(100);
    expect(result.contradictingWeight).toBe(10);
    expect(result.evidenceStrength).toBeCloseTo(0.818, 2);
  });

  it("Determinism: same input → same output", () => {
    const supporting = [node("s1", 80), node("s2", 90)];
    const contradicting = [node("c1", 70)];
    const r1 = calculateConfidence(supporting, contradicting);
    const r2 = calculateConfidence(supporting, contradicting);
    expect(r1.confidence).toBe(r2.confidence);
    expect(r1.evidenceStrength).toBe(r2.evidenceStrength);
    expect(r1.sampleSizeFactor).toBe(r2.sampleSizeFactor);
  });

  it("Result includes all diagnostic fields", () => {
    const result = calculateConfidence([node("s1", 80)], [node("c1", 40)]);
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("evidenceStrength");
    expect(result).toHaveProperty("sampleSizeFactor");
    expect(result).toHaveProperty("supportingWeight");
    expect(result).toHaveProperty("contradictingWeight");
    expect(result).toHaveProperty("totalWeight");
    expect(result).toHaveProperty("totalEvidenceCount");
  });
});
