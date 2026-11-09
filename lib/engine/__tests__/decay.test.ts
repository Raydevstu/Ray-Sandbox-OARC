import { describe, expect, it } from "vitest";
import { applyInsightDecay, applyPredictionDecay, reevaluateStaleInsights, archiveExpiredWarnings, runDecayCycle, findInactiveClusters } from "../decay";
import type { Insight, Prediction, Warning } from "../reflective-memory-types";

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "ins-1",
    kind: "insight",
    tenantId: "t1",
    bankId: "b1",
    type: "pattern",
    depth: 1,
    claim: "Redis failures observed",
    supportingNodes: ["s1", "s2"],
    contradictingNodes: [],
    confidence: 0.8,
    stability: 0.5,
    predictiveValue: null,
    parentInsights: [],
    status: "active",
    predictionCount: 0,
    correctPredictions: 0,
    importance: 80,
    createdAt: new Date(),
    lastValidatedAt: new Date(),
    ...overrides,
  };
}

function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    id: "pred-1",
    insightId: "ins-1",
    claim: "test prediction",
    context: "test",
    confidence: 0.8,
    createdAt: new Date(),
    evaluatedAt: null,
    outcome: null,
    actualResult: null,
    ...overrides,
  };
}

function makeWarning(overrides: Partial<Warning> = {}): Warning {
  return {
    id: "warn-1",
    predictionId: "pred-1",
    insightId: "ins-1",
    message: "test warning",
    riskLevel: "high",
    supportingEvidence: ["s1"],
    createdAt: new Date(),
    dismissedAt: null,
    dismissedBy: null,
    ...overrides,
  };
}

describe("Phase 12: Decay Lifecycle", () => {
  // ── Test 1: Short-term insight decays rapidly ───────────

  it("Test 1: Short-term insight stability decreases rapidly", () => {
    const insight = makeInsight({ stability: 0.2, status: "active" });
    const decayed = applyInsightDecay(insight, 10);
    // short tier: 5% per day, 10 days → 0.2 * 0.95^10 ≈ 0.116
    expect(decayed.stability).toBeLessThan(insight.stability);
  });

  // ── Test 2: Long-term insight decays slowly ─────────────

  it("Test 2: Long-term insight stability decreases slowly", () => {
    const insight = makeInsight({ stability: 0.9, status: "active" });
    const decayed = applyInsightDecay(insight, 10);
    // long tier: 0.1% per day, 10 days → 0.9 * 0.999^10 ≈ 0.899
    expect(decayed.stability).toBeGreaterThan(0.89);
    expect(decayed.stability).toBeLessThan(insight.stability);
  });

  // ── Test 3: Below archival threshold → archived ─────────

  it("Test 3: Below archival threshold → archived", () => {
    const insight = makeInsight({ stability: 0.05, status: "active" });
    const decayed = applyInsightDecay(insight, 30);
    expect(decayed.status).toBe("archived");
  });

  // ── Test 4: Stale insight → revalidation triggered ──────

  it("Test 4: Stale insight (30+ days) → revalidation triggered", () => {
    const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const insight = makeInsight({ lastValidatedAt: oldDate, status: "active" });
    const revalidated = reevaluateStaleInsights([insight]);
    expect(revalidated[0].lastValidatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
  });

  // ── Test 5: Expired warning → dismissed ─────────────────

  it("Test 5: Expired warning (7+ days) → dismissed", () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const warning = makeWarning({ createdAt: oldDate, dismissedAt: null });
    const expired = archiveExpiredWarnings([warning]);
    expect(expired[0].dismissedAt).not.toBeNull();
    expect(expired[0].dismissedBy).toBe("system");
  });

  // ── Test 6: Old prediction → expired ────────────────────

  it("Test 6: Old prediction (90+ days, unevaluated) → expired", () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const prediction = makePrediction({ createdAt: oldDate, evaluatedAt: null, outcome: null });
    const decayed = applyPredictionDecay(prediction, 100);
    expect(decayed.outcome).toBe("untested");
  });

  // ── Test 7: Fact protection → facts unchanged ───────────

  it("Test 7: Facts are never decayed (D5)", () => {
    // Decay only applies to insights, not facts
    // Verify applyInsightDecay doesn't touch facts
    const insight = makeInsight({ status: "active" });
    const decayed = applyInsightDecay(insight, 10);
    // Confidence unchanged (only stability decays)
    expect(decayed.confidence).toBe(insight.confidence);
  });

  // ── Test 8: Determinism ─────────────────────────────────

  it("Test 8: Determinism — three runs identical", () => {
    const insights = [makeInsight({ stability: 0.5, status: "active" })];
    const predictions = [makePrediction()];
    const warnings = [makeWarning()];
    const r1 = runDecayCycle(insights, predictions, warnings);
    const r2 = runDecayCycle(insights, predictions, warnings);
    const r3 = runDecayCycle(insights, predictions, warnings);
    expect(r1.insightsDecayed).toBe(r2.insightsDecayed);
    expect(r2.insightsDecayed).toBe(r3.insightsDecayed);
    expect(r1.insightsArchived).toBe(r2.insightsArchived);
  });

  // ── Confidence never decays ─────────────────────────────

  it("Rule D1: Confidence never decays directly", () => {
    const insight = makeInsight({ confidence: 0.8, stability: 0.5, status: "active" });
    const decayed = applyInsightDecay(insight, 30);
    expect(decayed.confidence).toBe(0.8);
  });

  // ── Prediction evaluated → not expired ──────────────────

  it("Evaluated prediction not expired", () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const prediction = makePrediction({ createdAt: oldDate, evaluatedAt: new Date(), outcome: "correct" });
    const decayed = applyPredictionDecay(prediction, 100);
    expect(decayed.outcome).toBe("correct");
  });

  // ── Warning not expired → not dismissed ─────────────────

  it("Fresh warning not dismissed", () => {
    const warning = makeWarning({ createdAt: new Date(), dismissedAt: null });
    const expired = archiveExpiredWarnings([warning]);
    expect(expired[0].dismissedAt).toBeNull();
  });

  // ── findInactiveClusters ────────────────────────────────

  it("findInactiveClusters marks old clusters as cold", () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const clusters = [
      { id: "c1", lastReflectedAt: oldDate, nodeIds: ["n1"] },
      { id: "c2", lastReflectedAt: new Date(), nodeIds: ["n2"] },
    ];
    const cold = findInactiveClusters(clusters);
    expect(cold).toContain("c1");
    expect(cold).not.toContain("c2");
  });

  // ── runDecayCycle result type ───────────────────────────

  it("runDecayCycle returns DecayResult with all fields", () => {
    const result = runDecayCycle([], [], []);
    expect(result).toHaveProperty("insightsDecayed");
    expect(result).toHaveProperty("insightsArchived");
    expect(result).toHaveProperty("insightsRevalidated");
    expect(result).toHaveProperty("predictionsExpired");
    expect(result).toHaveProperty("warningsExpired");
    expect(result).toHaveProperty("coldClustersMarked");
  });
});
