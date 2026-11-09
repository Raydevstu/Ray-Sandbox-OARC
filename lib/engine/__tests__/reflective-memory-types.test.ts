import { describe, it, expect } from "vitest";
import { createFact, createInsight, createEvidenceLink } from "../reflective-memory-types";

describe("reflective-memory-types", () => {
  it("creates a Fact with correct kind and defaults", () => {
    const fact = createFact({
      id: "f1",
      tenantId: "t1",
      bankId: "b1",
      claim: "Redis failed under load",
      provenance: { source: "retain" },
    });
    expect(fact.kind).toBe("fact");
    expect(fact.entity).toBe("general");
    expect(fact.category).toBe("workflow");
    expect(fact.confidence).toBe(0.5);
    expect(fact.importance).toBe(50);
    expect(fact.occurrences).toBe(1);
    expect(fact.createdAt).toBeInstanceOf(Date);
    expect(fact.lastValidatedAt).toBeInstanceOf(Date);
  });

  it("creates an Insight with correct kind and defaults", () => {
    const insight = createInsight({
      id: "i1",
      tenantId: "t1",
      bankId: "b1",
      type: "pattern",
      depth: 1,
      claim: "Infrastructure changes frequently fail",
      supportingNodes: ["f1", "f2", "f3"],
    });
    expect(insight.kind).toBe("insight");
    expect(insight.type).toBe("pattern");
    expect(insight.depth).toBe(1);
    expect(insight.status).toBe("candidate");
    expect(insight.confidence).toBe(0.3);
    expect(insight.stability).toBe(0.5);
    expect(insight.predictiveValue).toBeNull();
    expect(insight.supportingNodes).toEqual(["f1", "f2", "f3"]);
    expect(insight.contradictingNodes).toEqual([]);
    expect(insight.parentInsights).toEqual([]);
    expect(insight.predictionCount).toBe(0);
    expect(insight.correctPredictions).toBe(0);
    expect(insight.importance).toBe(80);
  });

  it("creates an EvidenceLink with defaults", () => {
    const link = createEvidenceLink({
      id: "e1",
      sourceNodeId: "i1",
      targetNodeId: "f1",
      relation: "supports",
    });
    expect(link.relation).toBe("supports");
    expect(link.weight).toBe(1.0);
    expect(link.createdAt).toBeInstanceOf(Date);
  });

  it("Fact and Insight are distinct kinds", () => {
    const fact = createFact({ id: "f2", tenantId: "t1", bankId: "b1", claim: "test", provenance: { source: "retain" } });
    const insight = createInsight({ id: "i2", tenantId: "t1", bankId: "b1", type: "causal", depth: 2, claim: "test", supportingNodes: ["f2"] });
    expect(fact.kind).not.toBe(insight.kind);
  });

  it("Insight depth is constrained to 1-3", () => {
    const i1 = createInsight({ id: "i3", tenantId: "t1", bankId: "b1", type: "pattern", depth: 1, claim: "d1", supportingNodes: [] });
    const i2 = createInsight({ id: "i4", tenantId: "t1", bankId: "b1", type: "pattern", depth: 2, claim: "d2", supportingNodes: [] });
    const i3 = createInsight({ id: "i5", tenantId: "t1", bankId: "b1", type: "pattern", depth: 3, claim: "d3", supportingNodes: [] });
    expect(i1.depth).toBe(1);
    expect(i2.depth).toBe(2);
    expect(i3.depth).toBe(3);
  });
});
