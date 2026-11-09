import { describe, expect, it } from "vitest";
import { generatePredictions, evaluatePrediction, updatePredictiveValue, createWarning, getMatchingInsights, generatePredictionsWithWarnings } from "../predict";
import type { Insight } from "../reflective-memory-types";
import type { TaskContext as TC } from "../predict";

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "ins-1",
    kind: "insight",
    tenantId: "t1",
    bankId: "b1",
    type: "pattern",
    depth: 1,
    claim: "Infrastructure migrations frequently fail",
    supportingNodes: ["s1", "s2"],
    contradictingNodes: [],
    confidence: 0.8,
    stability: 0.7,
    predictiveValue: 0.75,
    parentInsights: [],
    status: "active",
    predictionCount: 5,
    correctPredictions: 4,
    importance: 80,
    createdAt: new Date(),
    lastValidatedAt: new Date(),
    ...overrides,
  };
}

const ctx: TC = { entities: ["infrastructure", "migration"], title: "Migrate PostgreSQL schema" };

describe("Phase 11: Prediction Engine", () => {
  // ── Test 1: Matching insight → prediction ───────────────

  it("Test 1: Matching insight → prediction generated", () => {
    const insights = [makeInsight()];
    const preds = generatePredictions(ctx, insights);
    expect(preds).toHaveLength(1);
    expect(preds[0].insightId).toBe("ins-1");
    expect(preds[0].outcome).toBeNull();
  });

  // ── Test 2: Low predictive value → no prediction ────────

  it("Test 2: Low predictive value → no prediction", () => {
    const insights = [makeInsight({ predictiveValue: 0.3 })];
    const preds = generatePredictions(ctx, insights);
    expect(preds).toHaveLength(0);
  });

  // ── Test 3: Insufficient prediction history → predictiveValue null ──

  it("Test 3: Insufficient history → predictiveValue null", () => {
    const insight = makeInsight({ predictionCount: 1, correctPredictions: 1, predictiveValue: null });
    const updated = updatePredictiveValue(insight, [{ correct: true }]);
    // Only 1 prediction, < 3 threshold → null
    expect(updated.predictiveValue).toBeNull();
  });

  // ── Test 4: Correct evaluation → predictiveValue increases ──

  it("Test 4: Correct evaluation → predictiveValue increases", () => {
    const evaluations = [
      { correct: true }, { correct: true }, { correct: true },
      { correct: true }, { correct: true },
    ];
    const insight = makeInsight({ predictionCount: 0, correctPredictions: 0, predictiveValue: null });
    const updated = updatePredictiveValue(insight, evaluations);
    expect(updated.predictiveValue).toBe(1.0);
    expect(updated.correctPredictions).toBe(5);
  });

  // ── Test 5: Incorrect evaluation → predictiveValue decreases ──

  it("Test 5: Incorrect evaluation → predictiveValue decreases", () => {
    const evaluations = [
      { correct: true }, { correct: true }, { correct: false },
      { correct: false }, { correct: false },
    ];
    const insight = makeInsight({ predictionCount: 0, correctPredictions: 0, predictiveValue: null });
    const updated = updatePredictiveValue(insight, evaluations);
    expect(updated.predictiveValue).toBe(0.4);
  });

  // ── Test 6: Warning generation ──────────────────────────

  it("Test 6: Warning generated for high-confidence prediction", () => {
    const insights = [makeInsight({ confidence: 0.8, predictiveValue: 0.75 })];
    const { warnings } = generatePredictionsWithWarnings(ctx, insights);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toContain("Historical Pattern Detected");
    expect(warnings[0].supportingEvidence).toEqual(insights[0].supportingNodes);
  });

  // ── Test 7: Low confidence → prediction exists, warning suppressed ──

  it("Test 7: Low confidence → prediction exists, warning suppressed", () => {
    const insights = [makeInsight({ confidence: 0.4, predictiveValue: 0.75 })];
    const { predictions, warnings } = generatePredictionsWithWarnings(ctx, insights);
    expect(predictions).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  // ── Test 8: Determinism ─────────────────────────────────

  it("Test 8: Determinism — three runs identical", () => {
    const insights = [makeInsight()];
    const r1 = generatePredictions(ctx, insights);
    const r2 = generatePredictions(ctx, insights);
    const r3 = generatePredictions(ctx, insights);
    expect(r1.map((p) => p.insightId)).toEqual(r2.map((p) => p.insightId));
    expect(r2.map((p) => p.insightId)).toEqual(r3.map((p) => p.insightId));
  });

  // ── Rule P1: Only active/reinforced ─────────────────────

  it("P1: Archived/candidate/invalidated insights excluded", () => {
    const insights = [
      makeInsight({ id: "archived", status: "archived" }),
      makeInsight({ id: "candidate", status: "candidate" }),
      makeInsight({ id: "invalidated", status: "invalidated" }),
    ];
    const preds = generatePredictions(ctx, insights);
    expect(preds).toHaveLength(0);
  });

  // ── Reinforced insights participate ─────────────────────

  it("Reinforced insights participate in prediction", () => {
    const insights = [makeInsight({ status: "reinforced" })];
    const preds = generatePredictions(ctx, insights);
    expect(preds).toHaveLength(1);
  });

  // ── evaluatePrediction ──────────────────────────────────

  it("evaluatePrediction sets outcome and evaluatedAt", () => {
    const pred = generatePredictions(ctx, [makeInsight()])[0];
    const evaluated = evaluatePrediction(pred, "correct", "Task succeeded");
    expect(evaluated.outcome).toBe("correct");
    expect(evaluated.evaluatedAt).not.toBeNull();
    expect(evaluated.actualResult).toBe("Task succeeded");
  });

  // ── createWarning ───────────────────────────────────────

  it("createWarning returns null for low confidence", () => {
    const insight = makeInsight({ confidence: 0.4 });
    const pred = generatePredictions(ctx, [insight])[0];
    const warning = createWarning(pred, insight);
    expect(warning).toBeNull();
  });

  it("createWarning includes supporting evidence", () => {
    const insight = makeInsight({ confidence: 0.8, supportingNodes: ["s1", "s2"] });
    const pred = generatePredictions(ctx, [insight])[0];
    const warning = createWarning(pred, insight, "high");
    expect(warning).not.toBeNull();
    expect(warning!.supportingEvidence).toEqual(["s1", "s2"]);
    expect(warning!.message).toContain("s1");
  });

  // ── getMatchingInsights ─────────────────────────────────

  it("getMatchingInsights filters by entity match", () => {
    const insights = [
      makeInsight({ id: "match", claim: "Infrastructure migrations frequently fail" }),
      makeInsight({ id: "nomatch", claim: "User prefers dark mode" }),
    ];
    const matching = getMatchingInsights(ctx, insights);
    expect(matching.map((i) => i.id)).toContain("match");
    expect(matching.map((i) => i.id)).not.toContain("nomatch");
  });

  // ── P3: predictiveValue null with <3 predictions ───────

  it("P3: predictiveValue null when predictionCount < 3", () => {
    const insight = makeInsight({ predictionCount: 2, predictiveValue: null });
    const updated = updatePredictiveValue(insight, [{ correct: true }, { correct: true }]);
    expect(updated.predictiveValue).toBeNull();
  });

  // ── P3: predictiveValue set when >=3 predictions ───────

  it("P3: predictiveValue set when predictionCount >= 3", () => {
    const insight = makeInsight({ predictionCount: 0, predictiveValue: null });
    const updated = updatePredictiveValue(insight, [
      { correct: true }, { correct: true }, { correct: true },
    ]);
    expect(updated.predictiveValue).toBe(1.0);
    expect(updated.predictionCount).toBe(3);
  });
});
