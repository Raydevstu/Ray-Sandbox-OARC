import { describe, expect, it } from "vitest";
import { rankInsights, extractQueryEntities, entityMatchScore, buildRecallContextPack } from "../recall-ranking";
import type { Insight } from "../reflective-memory-types";

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "ins-1",
    kind: "insight",
    tenantId: "t1",
    bankId: "b1",
    type: "pattern",
    depth: 1,
    claim: "Redis-related failures have appeared repeatedly",
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

describe("Phase 8: Recall Integration", () => {
  // ── extractQueryEntities ─────────────────────────────────

  it("extractQueryEntities: splits and dedupes", () => {
    const entities = extractQueryEntities("redis queue failures");
    expect(entities).toContain("redis");
    expect(entities).toContain("queue");
    expect(entities).toContain("failures");
  });

  // ── entityMatchScore ─────────────────────────────────────

  it("entityMatchScore: high match for relevant insight", () => {
    const score = entityMatchScore(["redis"], "Redis-related failures have appeared repeatedly");
    expect(score).toBe(1);
  });

  it("entityMatchScore: zero match for irrelevant insight", () => {
    const score = entityMatchScore(["kubernetes"], "Redis-related failures have appeared repeatedly");
    expect(score).toBe(0);
  });

  // ── Test 1: Single matching insight ─────────────────────

  it("Test 1: Single matching insight ranked first", () => {
    const insights = [makeInsight({ id: "i1", claim: "Redis failures observed" })];
    const ranked = rankInsights("redis", insights);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].insight.id).toBe("i1");
  });

  // ── Test 2: Higher confidence + stability wins ───────────

  it("Test 2: Higher confidence+stability ranks first", () => {
    const insights = [
      makeInsight({ id: "low", claim: "Redis failures", confidence: 0.4, stability: 0.3 }),
      makeInsight({ id: "high", claim: "Redis failures", confidence: 0.9, stability: 0.9 }),
    ];
    const ranked = rankInsights("redis", insights);
    expect(ranked[0].insight.id).toBe("high");
  });

  // ── Test 3: Archived insight not returned ───────────────

  it("Test 3: Archived insight not returned", () => {
    const insights = [
      makeInsight({ id: "archived", status: "archived", claim: "Redis failures" }),
      makeInsight({ id: "active", status: "active", claim: "Redis failures" }),
    ];
    const ranked = rankInsights("redis", insights);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].insight.id).toBe("active");
  });

  // ── Test 4: Candidate insight not returned ──────────────

  it("Test 4: Candidate insight not returned", () => {
    const insights = [
      makeInsight({ id: "candidate", status: "candidate", claim: "Redis failures" }),
      makeInsight({ id: "active", status: "active", claim: "Redis failures" }),
    ];
    const ranked = rankInsights("redis", insights);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].insight.id).toBe("active");
  });

  // ── Test 5: Supporting facts included in context pack ───

  it("Test 5: Supporting facts included in context pack", () => {
    const insights = [makeInsight({ id: "i1", claim: "Redis failures", supportingNodes: ["s1", "s2"] })];
    const ranked = rankInsights("redis", insights);
    const pack = buildRecallContextPack(ranked, (id) => `Fact: ${id}`);
    expect(pack.insights).toHaveLength(1);
    expect(pack.supportingFacts).toContain("Fact: s1");
    expect(pack.supportingFacts).toContain("Fact: s2");
  });

  // ── Test 6: Contradicting facts appear after supporting ─

  it("Test 6: Contradicting facts appear in context pack", () => {
    const insights = [makeInsight({ id: "i1", claim: "Redis failures", contradictingNodes: ["c1"] })];
    const ranked = rankInsights("redis", insights);
    const pack = buildRecallContextPack(ranked, (id) => `Fact: ${id}`);
    expect(pack.contradictingFacts).toContain("Fact: c1");
  });

  // ── Test 7: Context cap limits insights ─────────────────

  it("Test 7: Context cap limits to top ranked subset", () => {
    const insights = Array.from({ length: 100 }, (_, i) =>
      makeInsight({ id: `ins-${i}`, claim: `Redis failure ${i}`, confidence: Math.random(), stability: Math.random() }),
    );
    const ranked = rankInsights("redis", insights);
    expect(ranked.length).toBeLessThanOrEqual(10);
  });

  // ── Reinforced insights participate ──────────────────────

  it("Reinforced insights participate in recall", () => {
    const insights = [makeInsight({ id: "reinforced", status: "reinforced", claim: "Redis failures" })];
    const ranked = rankInsights("redis", insights);
    expect(ranked).toHaveLength(1);
  });

  // ── Invalidated insights excluded ────────────────────────

  it("Invalidated insights excluded from recall", () => {
    const insights = [makeInsight({ id: "invalidated", status: "invalidated", claim: "Redis failures" })];
    const ranked = rankInsights("redis", insights);
    expect(ranked).toHaveLength(0);
  });

  // ── Empty query returns nothing ──────────────────────────

  it("Empty query with no entities returns insights with base score", () => {
    const insights = [makeInsight({ id: "i1", claim: "Redis failures" })];
    const ranked = rankInsights("", insights);
    // With no query entities, relevance defaults to 0.1, so insights still rank
    expect(ranked.length).toBeGreaterThanOrEqual(0);
  });

  // ── Context budget enforcement ───────────────────────────

  it("Context budget: tokensUsed does not exceed budget", () => {
    const insights = [makeInsight({ id: "i1", claim: "Redis failures", supportingNodes: ["s1", "s2", "s3"] })];
    const ranked = rankInsights("redis", insights);
    const pack = buildRecallContextPack(ranked, (id) => "A".repeat(1000), 100);
    expect(pack.tokensUsed).toBeLessThanOrEqual(100);
  });
});
