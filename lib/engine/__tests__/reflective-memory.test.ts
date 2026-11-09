import { describe, expect, it } from "vitest";
import { generateCandidateInsights, type ReflectFact, type ReflectionClusterInput } from "../reflective-memory";

function makeFact(overrides: Partial<ReflectFact> & { id: string }): ReflectFact {
  return {
    id: overrides.id,
    tenantId: "t1",
    bankId: "b1",
    entity: overrides.entity ?? "Redis",
    category: overrides.category ?? "failure",
    claim: overrides.claim ?? "Redis failed",
    importance: 80,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
    sessionId: overrides.sessionId ?? "s1",
  };
}

function makeCluster(facts: ReflectFact[], entity = "Redis"): ReflectionClusterInput {
  return {
    id: "cluster-1",
    tenantId: "t1",
    bankId: "b1",
    entity,
    nodeIds: facts.map((f) => f.id),
    facts,
  };
}

describe("Phase 3: Candidate Insight Generation", () => {
  it("Recurring Failure: 3+ failures on same entity → 1 pattern insight", () => {
    const facts = [
      makeFact({ id: "f1", category: "failure" }),
      makeFact({ id: "f2", category: "failure" }),
      makeFact({ id: "f3", category: "failure" }),
    ];
    const insights = generateCandidateInsights(makeCluster(facts));
    const patterns = insights.filter((i) => i.type === "pattern");
    expect(patterns).toHaveLength(1);
    expect(patterns[0].status).toBe("candidate");
    expect(patterns[0].supportingNodes).toHaveLength(3);
  });

  it("Insufficient Evidence: 2 failures → 0 pattern insights", () => {
    const facts = [
      makeFact({ id: "f1", category: "failure" }),
      makeFact({ id: "f2", category: "failure" }),
    ];
    const insights = generateCandidateInsights(makeCluster(facts));
    const patterns = insights.filter((i) => i.type === "pattern");
    expect(patterns).toHaveLength(0);
  });

  it("Causal Success: decision followed by success within 48h → 1 causal insight", () => {
    const decision = makeFact({
      id: "d1",
      category: "decision",
      claim: "Use Redis",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const success = makeFact({
      id: "s1",
      category: "success",
      claim: "Redis handled load",
      createdAt: new Date("2026-01-01T12:00:00Z"),
    });
    const insights = generateCandidateInsights(makeCluster([decision, success]));
    const causals = insights.filter((i) => i.type === "causal");
    expect(causals.length).toBeGreaterThanOrEqual(1);
    expect(causals[0].status).toBe("candidate");
  });

  it("Duplicate Protection: same input produces same candidates, no dupes", () => {
    const facts = [
      makeFact({ id: "f1", category: "failure" }),
      makeFact({ id: "f2", category: "failure" }),
      makeFact({ id: "f3", category: "failure" }),
    ];
    const insights1 = generateCandidateInsights(makeCluster(facts));
    const insights2 = generateCandidateInsights(makeCluster(facts));
    expect(insights1.map((i) => i.id)).toEqual(insights2.map((i) => i.id));
    // No duplicate ids within a single run
    const ids = insights1.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Cluster Isolation: Redis cluster doesn't generate insights from K8s facts", () => {
    const facts = [
      makeFact({ id: "f1", entity: "Redis", category: "failure" }),
      makeFact({ id: "f2", entity: "Redis", category: "failure" }),
      makeFact({ id: "f3", entity: "Redis", category: "failure" }),
      makeFact({ id: "k1", entity: "Kubernetes", category: "failure" }),
      makeFact({ id: "k2", entity: "Kubernetes", category: "failure" }),
      makeFact({ id: "k3", entity: "Kubernetes", category: "failure" }),
    ];
    const redisInsights = generateCandidateInsights(makeCluster(facts.filter((f) => f.entity === "Redis"), "Redis"));
    const k8sInsights = generateCandidateInsights(makeCluster(facts.filter((f) => f.entity === "Kubernetes"), "Kubernetes"));
    // Redis cluster only has Redis insights
    for (const ins of redisInsights) {
      expect(ins.supportingNodes.every((n) => facts.find((f) => f.id === n)?.entity === "Redis")).toBe(true);
    }
    // K8s cluster only has K8s insights
    for (const ins of k8sInsights) {
      expect(ins.supportingNodes.every((n) => facts.find((f) => f.id === n)?.entity === "Kubernetes")).toBe(true);
    }
  });

  it("All insights have status=candidate, confidence=0.3, stability=0.5 placeholders", () => {
    const facts = [
      makeFact({ id: "f1", category: "failure" }),
      makeFact({ id: "f2", category: "failure" }),
      makeFact({ id: "f3", category: "failure" }),
    ];
    const insights = generateCandidateInsights(makeCluster(facts));
    for (const ins of insights) {
      expect(ins.status).toBe("candidate");
      expect(ins.confidence).toBe(0.3);
      expect(ins.stability).toBe(0.5);
      expect(ins.predictiveValue).toBeNull();
    }
  });

  it("Determinism: same facts produce identical output on repeated calls", () => {
    const facts = [
      makeFact({ id: "f1", category: "failure" }),
      makeFact({ id: "f2", category: "failure" }),
      makeFact({ id: "f3", category: "failure" }),
      makeFact({ id: "d1", category: "decision", createdAt: new Date("2026-01-01T00:00:00Z") }),
      makeFact({ id: "s1", category: "success", createdAt: new Date("2026-01-01T12:00:00Z") }),
    ];
    const r1 = generateCandidateInsights(makeCluster(facts));
    const r2 = generateCandidateInsights(makeCluster(facts));
    const r3 = generateCandidateInsights(makeCluster(facts));
    expect(r1.map((i) => i.id)).toEqual(r2.map((i) => i.id));
    expect(r2.map((i) => i.id)).toEqual(r3.map((i) => i.id));
  });
});
