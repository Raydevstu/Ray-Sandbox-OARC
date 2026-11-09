import { describe, expect, it } from "vitest";
import { generateMetaInsights } from "../meta-insights";
import type { Insight } from "../reflective-memory-types";

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
    stability: 0.7,
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

describe("Phase 9: Meta-Insight Generation", () => {
  // ── Test 1: Two qualifying insights → meta-insight ──────

  it("Test 1: Two qualifying insights → meta-insight candidate generated", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", confidence: 0.8, stability: 0.7 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", confidence: 0.7, stability: 0.6 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas.length).toBeGreaterThanOrEqual(1);
    expect(metas[0].status).toBe("candidate");
    expect(metas[0].depth).toBe(2);
    expect(metas[0].parentInsights).toContain("i1");
    expect(metas[0].parentInsights).toContain("i2");
  });

  // ── Test 2: One supporting insight → none ───────────────

  it("Test 2: One supporting insight → none generated", () => {
    const insights = [makeInsight({ id: "i1", claim: "Redis failures observed" })];
    const metas = generateMetaInsights(insights);
    expect(metas).toHaveLength(0);
  });

  // ── Test 3: Low confidence support → none ───────────────

  it("Test 3: Low confidence support → none generated", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", confidence: 0.4 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", confidence: 0.8 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas).toHaveLength(0);
  });

  // ── Test 4: Depth limit → none ──────────────────────────

  it("Test 4: Depth 3 insight → none generated", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", depth: 3 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", depth: 1 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas).toHaveLength(0);
  });

  // ── Test 5: Diversity requirement (same entity only) ────

  it("Test 5: Same entity only → none generated", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", confidence: 0.8 }),
      makeInsight({ id: "i2", claim: "Redis timeouts detected", confidence: 0.8 }),
    ];
    const metas = generateMetaInsights(insights);
    // Both have entity "redis" — no diversity
    expect(metas).toHaveLength(0);
  });

  // ── Test 6: Cycle prevention ────────────────────────────

  it("Test 6: Cycle prevention — parent already includes child", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", parentInsights: ["i2"], confidence: 0.8 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", parentInsights: ["i1"], confidence: 0.8 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas).toHaveLength(0);
  });

  // ── Test 7: Determinism ─────────────────────────────────

  it("Test 7: Determinism — same inputs → same outputs", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", confidence: 0.8, stability: 0.7 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", confidence: 0.7, stability: 0.6 }),
    ];
    const r1 = generateMetaInsights(insights);
    const r2 = generateMetaInsights(insights);
    const r3 = generateMetaInsights(insights);
    expect(r1.map((i) => i.id)).toEqual(r2.map((i) => i.id));
    expect(r2.map((i) => i.id)).toEqual(r3.map((i) => i.id));
  });

  // ── M1: Only active/reinforced participate ──────────────

  it("M1: Candidate/archived/invalidated insights excluded", () => {
    const insights = [
      makeInsight({ id: "i1", status: "candidate", claim: "Redis failures observed", confidence: 0.8 }),
      makeInsight({ id: "i2", status: "archived", claim: "Kubernetes deployments failed", confidence: 0.8 }),
      makeInsight({ id: "i3", status: "invalidated", claim: "Queue issues found", confidence: 0.8 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas).toHaveLength(0);
  });

  // ── Confidence penalty ──────────────────────────────────

  it("Meta-confidence = avg(parent confidence) * 0.9", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", confidence: 0.8, stability: 0.7 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", confidence: 0.8, stability: 0.7 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas.length).toBeGreaterThanOrEqual(1);
    const expectedConf = (0.8 + 0.8) / 2 * 0.9;
    expect(metas[0].confidence).toBeCloseTo(expectedConf, 2);
  });

  // ── Parent tracking ─────────────────────────────────────

  it("Parent tracking: parentInsights and supportingNodes populated", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", supportingNodes: ["s1", "s2"], confidence: 0.8 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", supportingNodes: ["s3", "s4"], confidence: 0.8 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas.length).toBeGreaterThanOrEqual(1);
    expect(metas[0].parentInsights).toHaveLength(2);
    expect(metas[0].supportingNodes).toContain("s1");
    expect(metas[0].supportingNodes).toContain("s3");
  });

  // ── Depth tracking ──────────────────────────────────────

  it("Depth 2 insight from depth 1 parents", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", depth: 1, confidence: 0.8 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", depth: 1, confidence: 0.8 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas.length).toBeGreaterThanOrEqual(1);
    expect(metas[0].depth).toBe(2);
  });

  it("Depth 3 insight from depth 2 parents", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", depth: 2, confidence: 0.8 }),
      makeInsight({ id: "i2", claim: "Kubernetes deployments failed", depth: 2, confidence: 0.8 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas.length).toBeGreaterThanOrEqual(1);
    expect(metas[0].depth).toBe(3);
  });

  // ── Reinforced insights participate ─────────────────────

  it("Reinforced insights participate in meta-generation", () => {
    const insights = [
      makeInsight({ id: "i1", status: "reinforced", claim: "Redis failures observed", confidence: 0.8 }),
      makeInsight({ id: "i2", status: "reinforced", claim: "Kubernetes deployments failed", confidence: 0.8 }),
    ];
    const metas = generateMetaInsights(insights);
    expect(metas.length).toBeGreaterThanOrEqual(1);
  });
});
