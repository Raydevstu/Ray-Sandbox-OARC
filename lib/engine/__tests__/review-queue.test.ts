import { describe, expect, it } from "vitest";
import { verifyCandidate, promoteCandidate, reinforceInsight, archiveInsight, processReviewQueue, findDuplicateInsight } from "../review-queue";
import type { Insight } from "../reflective-memory-types";

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "ins-1",
    kind: "insight",
    tenantId: "t1",
    bankId: "b1",
    type: "pattern",
    depth: 1,
    claim: "test claim",
    supportingNodes: ["s1", "s2", "s3"],
    contradictingNodes: [],
    confidence: 0.7,
    stability: 0.5,
    predictiveValue: null,
    parentInsights: [],
    status: "candidate",
    predictionCount: 0,
    correctPredictions: 0,
    importance: 80,
    createdAt: new Date(),
    lastValidatedAt: new Date(),
    ...overrides,
  };
}

describe("Phase 7: Insight Review Queue", () => {
  // ── verifyCandidate ──────────────────────────────────────

  it("Test 1: Valid candidate → approved", () => {
    const candidate = makeInsight();
    const result = verifyCandidate(candidate, []);
    expect(result.approved).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("Test 2: Insufficient evidence (1 support node) → rejected", () => {
    const candidate = makeInsight({ supportingNodes: ["s1"] });
    const result = verifyCandidate(candidate, []);
    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("insufficient_supporting_evidence");
  });

  it("Test 3: Low confidence (0.39) → rejected", () => {
    const candidate = makeInsight({ confidence: 0.39 });
    const result = verifyCandidate(candidate, []);
    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("confidence_below_threshold");
  });

  it("Test 4: Wrong status (active) → rejected", () => {
    const candidate = makeInsight({ status: "active" });
    const result = verifyCandidate(candidate, []);
    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("not_candidate");
  });

  it("Test 5: Duplicate candidate → not approved, duplicateInsightId set", () => {
    const existing = makeInsight({ id: "existing-1", status: "active", claim: "test claim" });
    const candidate = makeInsight({ id: "candidate-1", claim: "test claim" });
    const result = verifyCandidate(candidate, [existing]);
    expect(result.approved).toBe(false);
    expect(result.duplicateInsightId).toBe("existing-1");
  });

  it("Test 6: Budget exceeded (100 active) → rejected with budgetViolation", () => {
    const activeInsights = Array.from({ length: 100 }, (_, i) =>
      makeInsight({ id: `active-${i}`, status: "active" }),
    );
    const candidate = makeInsight({ id: "candidate-1" });
    const result = verifyCandidate(candidate, activeInsights);
    expect(result.approved).toBe(false);
    expect(result.budgetViolation).toBe(true);
    expect(result.reasons).toContain("budget_exceeded");
  });

  it("V4: Missing evidence links → rejected", () => {
    const candidate = makeInsight();
    const existingNodes = new Set(["s1"]); // s2, s3 missing
    const result = verifyCandidate(candidate, [], existingNodes);
    expect(result.approved).toBe(false);
    expect(result.reasons).toContain("missing_evidence_links");
  });

  // ── promoteCandidate ─────────────────────────────────────

  it("promoteCandidate sets status to active", () => {
    const candidate = makeInsight({ status: "candidate" });
    const promoted = promoteCandidate(candidate);
    expect(promoted.status).toBe("active");
  });

  // ── reinforceInsight ─────────────────────────────────────

  it("reinforceInsight unions supporting nodes and sets status to reinforced", () => {
    const existing = makeInsight({ id: "existing", status: "active", supportingNodes: ["s1", "s2"] });
    const candidate = makeInsight({ id: "candidate", supportingNodes: ["s2", "s3"] });
    const reinforced = reinforceInsight(existing, candidate);
    expect(reinforced.status).toBe("reinforced");
    expect(reinforced.supportingNodes).toContain("s1");
    expect(reinforced.supportingNodes).toContain("s2");
    expect(reinforced.supportingNodes).toContain("s3");
    expect(new Set(reinforced.supportingNodes).size).toBe(3);
    expect(reinforced.id).toBe("existing");
    expect(reinforced.createdAt).toEqual(existing.createdAt);
  });

  // ── archiveInsight ───────────────────────────────────────

  it("archiveInsight sets status to archived", () => {
    const insight = makeInsight({ status: "active" });
    const archived = archiveInsight(insight, "test reason");
    expect(archived.status).toBe("archived");
  });

  // ── findDuplicateInsight ─────────────────────────────────

  it("findDuplicateInsight matches same type + claim", () => {
    const existing = makeInsight({ id: "existing", status: "active", type: "pattern", claim: "test claim" });
    const candidate = makeInsight({ id: "candidate", type: "pattern", claim: "test claim" });
    const dup = findDuplicateInsight(candidate, [existing]);
    expect(dup).toBeDefined();
    expect(dup!.id).toBe("existing");
  });

  it("findDuplicateInsight returns undefined for different claims", () => {
    const existing = makeInsight({ id: "existing", status: "active", claim: "other claim" });
    const candidate = makeInsight({ id: "candidate", claim: "test claim" });
    const dup = findDuplicateInsight(candidate, [existing]);
    expect(dup).toBeUndefined();
  });

  // ── processReviewQueue ───────────────────────────────────

  it("Test 7: Mixed batch — 2 promoted, 1 reinforced, 2 rejected", () => {
    const existing = makeInsight({ id: "existing-1", status: "active", claim: "duplicate claim" });

    const valid1 = makeInsight({ id: "valid-1", claim: "valid claim 1" });
    const valid2 = makeInsight({ id: "valid-2", claim: "valid claim 2" });
    const duplicate = makeInsight({ id: "dup-1", claim: "duplicate claim" });
    const invalid1 = makeInsight({ id: "invalid-1", supportingNodes: ["s1"], claim: "invalid 1" });
    const invalid2 = makeInsight({ id: "invalid-2", confidence: 0.3, claim: "invalid 2" });

    const candidates = [valid1, valid2, duplicate, invalid1, invalid2];
    const activeInsights = [existing];

    const result = processReviewQueue(candidates, activeInsights);

    expect(result.promoted).toHaveLength(2);
    expect(result.reinforced).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
  });
});
