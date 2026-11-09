import { describe, expect, it } from "vitest";
import { mergeInsights, deduplicateInsights, enforceInsightBudget, summarizeInsights, runConsolidation } from "../reflective-consolidate";
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

describe("Phase 10: Consolidation Engine", () => {
  // ── Test 1: Three related insights → merged ─────────────

  it("Test 1: Three related insights → merged insight created, originals archived", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed" }),
      makeInsight({ id: "i2", claim: "Redis timeouts detected" }),
      makeInsight({ id: "i3", claim: "Redis connection drops" }),
    ];
    const result = runConsolidation(insights);
    expect(result.merged.length).toBeGreaterThanOrEqual(1);
    expect(result.archived.length).toBeGreaterThanOrEqual(3);
    // Merged insight has parentInsights
    expect(result.merged[0].parentInsights).toHaveLength(3);
  });

  // ── Test 2: Duplicate insights → one survives ───────────

  it("Test 2: Duplicate insights → one survives, rest archived", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", confidence: 0.9 }),
      makeInsight({ id: "i2", claim: "Redis failures observed", confidence: 0.7 }),
    ];
    const result = deduplicateInsights(insights);
    expect(result.kept).toHaveLength(1);
    expect(result.archived).toHaveLength(1);
    expect(result.deduplicatedCount).toBe(1);
    // Strongest survives
    expect(result.kept[0].id).toBe("i1");
  });

  // ── Test 3: Budget exceeded → <=100 active ─────────────

  it("Test 3: Budget exceeded (110 insights) → <=100 remain active", () => {
    const insights = Array.from({ length: 110 }, (_, i) =>
      makeInsight({ id: `ins-${i}`, claim: `Insight ${i} unique claim ${i}`, confidence: Math.random(), stability: Math.random() }),
    );
    const result = enforceInsightBudget(insights);
    expect(result.active.length).toBeLessThanOrEqual(100);
    expect(result.archived.length).toBeGreaterThanOrEqual(10);
  });

  // ── Test 4: Meta budget exceeded → <=50 meta ───────────

  it("Test 4: Meta budget exceeded (60 depth>1) → <=50 remain active", () => {
    const metaInsights = Array.from({ length: 60 }, (_, i) =>
      makeInsight({ id: `meta-${i}`, depth: 2, claim: `Meta insight ${i} unique`, confidence: Math.random(), stability: Math.random() }),
    );
    const result = enforceInsightBudget(metaInsights);
    const remainingMeta = result.active.filter((i) => i.depth > 1);
    expect(remainingMeta.length).toBeLessThanOrEqual(50);
  });

  // ── Test 5: Lineage preserved ───────────────────────────

  it("Test 5: Lineage preserved — parentInsights populated", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", supportingNodes: ["s1", "s2"] }),
      makeInsight({ id: "i2", claim: "Redis timeouts detected", supportingNodes: ["s3"] }),
      makeInsight({ id: "i3", claim: "Redis connection drops", supportingNodes: ["s4"] }),
    ];
    const merged = mergeInsights(insights);
    expect(merged.parentInsights).toContain("i1");
    expect(merged.parentInsights).toContain("i2");
    expect(merged.parentInsights).toContain("i3");
    expect(merged.supportingNodes).toContain("s1");
    expect(merged.supportingNodes).toContain("s3");
    expect(merged.supportingNodes).toContain("s4");
  });

  // ── Test 6: Determinism ─────────────────────────────────

  it("Test 6: Determinism — run three times, identical output", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed" }),
      makeInsight({ id: "i2", claim: "Redis timeouts detected" }),
      makeInsight({ id: "i3", claim: "Redis connection drops" }),
    ];
    const r1 = runConsolidation(insights);
    const r2 = runConsolidation(insights);
    const r3 = runConsolidation(insights);
    expect(r1.finalActiveCount).toBe(r2.finalActiveCount);
    expect(r2.finalActiveCount).toBe(r3.finalActiveCount);
    expect(r1.merged.map((i) => i.id)).toEqual(r2.merged.map((i) => i.id));
  });

  // ── Test 7: Unrelated entities not merged ───────────────

  it("Test 7: Unrelated entities not merged", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed" }),
      makeInsight({ id: "i2", claim: "User prefers TypeScript" }),
      makeInsight({ id: "i3", claim: "Career goal startup" }),
    ];
    const result = runConsolidation(insights);
    // No merge should happen (all different entities, none has 3+)
    expect(result.merged).toHaveLength(0);
  });

  // ── mergeInsights ───────────────────────────────────────

  it("mergeInsights preserves provenance", () => {
    const insights = [
      makeInsight({ id: "a", claim: "Redis failures" }),
      makeInsight({ id: "b", claim: "Redis timeouts" }),
    ];
    const merged = mergeInsights(insights);
    expect(merged.parentInsights).toContain("a");
    expect(merged.parentInsights).toContain("b");
  });

  // ── summarizeInsights ───────────────────────────────────

  it("summarizeInsights creates template-based summary", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed" }),
      makeInsight({ id: "i2", claim: "Redis timeouts detected" }),
    ];
    const summary = summarizeInsights(insights);
    expect(summary.claim).toContain("consolidated");
    expect(summary.parentInsights).toContain("i1");
    expect(summary.parentInsights).toContain("i2");
  });

  // ── CE-1: No deletion ───────────────────────────────────

  it("CE-1: Archived insights have status archived, not deleted", () => {
    const insights = Array.from({ length: 110 }, (_, i) =>
      makeInsight({ id: `ins-${i}`, claim: `Insight ${i} unique ${i}`, confidence: Math.random() }),
    );
    const result = enforceInsightBudget(insights);
    for (const archived of result.archived) {
      expect(archived.status).toBe("archived");
    }
  });

  // ── CE-4: Compression ratio ─────────────────────────────

  it("CE-4: Compression ratio tracked in result", () => {
    const insights = [
      makeInsight({ id: "i1", claim: "Redis failures observed", supportingNodes: ["s1", "s2", "s3"] }),
      makeInsight({ id: "i2", claim: "Redis timeouts detected", supportingNodes: ["s4"] }),
      makeInsight({ id: "i3", claim: "Redis connection drops", supportingNodes: ["s5"] }),
    ];
    const result = runConsolidation(insights);
    expect(result).toHaveProperty("compressionRatio");
    expect(typeof result.compressionRatio).toBe("number");
  });
});
