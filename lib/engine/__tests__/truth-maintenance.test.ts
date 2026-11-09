import { describe, expect, it } from "vitest";
import { detectContradictions, allSupportingSuperseded } from "../contradiction";
import { reevaluateInsight, archiveObsoleteInsight, createReplacementCandidate, findObsoleteInsights } from "../truth-maintenance";
import type { Insight, MemoryNode } from "../reflective-memory-types";

function makeNode(id: string, importance: number, entity?: string): MemoryNode {
  const now = new Date();
  return { id, kind: "fact", importance, createdAt: now, lastValidatedAt: now };
}

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "ins-1",
    kind: "insight",
    tenantId: "t1",
    bankId: "b1",
    type: "pattern",
    depth: 1,
    claim: "Redis-related failures have appeared repeatedly",
    supportingNodes: ["s1", "s2", "s3"],
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

describe("Phase 6: Contradiction + Truth Maintenance", () => {
  // ── Contradiction Detection ──────────────────────────────

  it("Direct Contradiction: high-importance contradicting node → reduce_confidence or higher", () => {
    const insight = makeInsight();
    const contradicting = [makeNode("c1", 70)];
    const results = detectContradictions(insight, contradicting);
    expect(results).toHaveLength(1);
    expect(results[0].nodeId).toBe("c1");
    expect(results[0].contradictionStrength).toBeCloseTo(0.7, 1);
    expect(["reduce_confidence", "archive", "replace"]).toContain(results[0].action);
  });

  it("Strong Contradiction: very high importance → replace action", () => {
    const insight = makeInsight();
    const contradicting = [makeNode("c1", 95)];
    const results = detectContradictions(insight, contradicting);
    expect(results[0].action).toBe("replace");
  });

  it("No False Contradiction: low-importance node → ignore", () => {
    const insight = makeInsight();
    const contradicting = [makeNode("c1", 10)];
    const results = detectContradictions(insight, contradicting);
    expect(results[0].action).toBe("ignore");
  });

  it("Entity boundary: supporting nodes are skipped", () => {
    const insight = makeInsight({ supportingNodes: ["s1"] });
    const nodes = [makeNode("s1", 90)]; // already supporting
    const results = detectContradictions(insight, nodes);
    expect(results).toHaveLength(0);
  });

  // ── allSupportingSuperseded ──────────────────────────────

  it("allSupportingSuperseded: true when all supporting nodes superseded", () => {
    const insight = makeInsight({ supportingNodes: ["s1", "s2"] });
    const superseded = new Set(["s1", "s2"]);
    expect(allSupportingSuperseded(insight, superseded)).toBe(true);
  });

  it("allSupportingSuperseded: false when only some superseded", () => {
    const insight = makeInsight({ supportingNodes: ["s1", "s2"] });
    const superseded = new Set(["s1"]);
    expect(allSupportingSuperseded(insight, superseded)).toBe(false);
  });

  // ── Truth Maintenance ───────────────────────────────────

  it("T1: All supporting facts superseded → invalidated", () => {
    const insight = makeInsight({ supportingNodes: ["s1", "s2"] });
    const superseded = new Set(["s1", "s2"]);
    const result = reevaluateInsight(insight, [], superseded);
    expect(result.insight.status).toBe("invalidated");
    expect(result.archived).toBe(true);
    expect(result.reason).toContain("superseded");
  });

  it("T2: Confidence < 0.4 → archived", () => {
    const insight = makeInsight({ confidence: 0.35, status: "active" });
    const result = reevaluateInsight(insight, []);
    expect(result.insight.status).toBe("archived");
    expect(result.archived).toBe(true);
    expect(result.reason).toContain("below threshold");
  });

  it("T3: Strong contradictions → archive + replacement candidate", () => {
    const insight = makeInsight({ status: "active" });
    const contradicting = [makeNode("c1", 90)];
    const result = reevaluateInsight(insight, contradicting);
    expect(result.insight.status).toBe("archived");
    expect(result.archived).toBe(true);
    expect(result.replacementCandidate).not.toBeNull();
    expect(result.replacementCandidate!.status).toBe("candidate");
    expect(result.replacementCandidate!.id).toContain("replacement");
  });

  it("No changes: low contradictions, high confidence → unchanged", () => {
    const insight = makeInsight({ confidence: 0.8, status: "active" });
    const contradicting = [makeNode("c1", 10)];
    const result = reevaluateInsight(insight, contradicting);
    expect(result.insight.status).toBe("active");
    expect(result.archived).toBe(false);
    expect(result.replacementCandidate).toBeNull();
  });

  it("Tension records created for significant contradictions", () => {
    const insight = makeInsight({ status: "active" });
    const contradicting = [makeNode("c1", 70)];
    const result = reevaluateInsight(insight, contradicting);
    expect(result.tensionRecords.length).toBeGreaterThanOrEqual(1);
    expect(result.tensionRecords[0].insightId).toBe(insight.id);
    expect(result.tensionRecords[0].resolved).toBe(false);
  });

  it("archiveObsoleteInsight sets status to archived", () => {
    const insight = makeInsight({ status: "active" });
    const archived = archiveObsoleteInsight(insight);
    expect(archived.status).toBe("archived");
    // Evidence graph preserved (TMS-1)
    expect(archived.supportingNodes).toEqual(insight.supportingNodes);
  });

  it("createReplacementCandidate creates candidate with swapped evidence", () => {
    const insight = makeInsight();
    const replacement = createReplacementCandidate(insight, ["c1", "c2"]);
    expect(replacement.status).toBe("candidate");
    expect(replacement.supportingNodes).toEqual(["c1", "c2"]);
    expect(replacement.contradictingNodes).toEqual(insight.supportingNodes);
    expect(replacement.id).toContain("replacement");
  });

  it("findObsoleteInsights returns active insights with all supporting superseded", () => {
    const insights = [
      makeInsight({ id: "i1", status: "active", supportingNodes: ["s1", "s2"] }),
      makeInsight({ id: "i2", status: "active", supportingNodes: ["s3"] }),
      makeInsight({ id: "i3", status: "archived", supportingNodes: ["s4"] }),
    ];
    const superseded = new Set(["s1", "s2", "s3"]);
    const obsolete = findObsoleteInsights(insights, superseded);
    expect(obsolete).toHaveLength(2);
    expect(obsolete.map((i) => i.id)).toContain("i1");
    expect(obsolete.map((i) => i.id)).toContain("i2");
  });
});
