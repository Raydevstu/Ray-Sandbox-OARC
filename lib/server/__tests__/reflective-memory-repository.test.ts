import { describe, expect, it } from "vitest";
import { createReflectiveMemoryRepository } from "../reflective-memory-repository";
import { createFact, createInsight } from "../../engine/reflective-memory-types";

function fakePool(rows: any[] = []) {
  const seen: { text: string; params: any[] }[] = [];
  return {
    seen,
    async query(text: string, params: any[] = []) {
      seen.push({ text, params });
      return { rows };
    },
  };
}

describe("reflective-memory-repository", () => {
  it("createFact issues INSERT INTO facts", async () => {
    const pool: any = fakePool();
    const repo = createReflectiveMemoryRepository(pool);
    const fact = createFact({ id: "f1", tenantId: "t1", bankId: "b1", claim: "test claim", provenance: { source: "retain" } });
    await repo.createFact(fact);
    const insert = pool.seen.find((s: any) => /INSERT INTO facts/i.test(s.text));
    expect(insert).toBeDefined();
    expect(insert.params[0]).toBe("f1");
    expect(insert.params[1]).toBe("t1");
    expect(insert.params[2]).toBe("b1");
  });

  it("getFact returns null when no rows", async () => {
    const pool: any = fakePool([]);
    const repo = createReflectiveMemoryRepository(pool);
    const result = await repo.getFact("t1", "b1", "nonexistent");
    expect(result).toBeNull();
  });

  it("getFact returns a Fact when row exists", async () => {
    const pool: any = fakePool([{
      id: "f1", tenant_id: "t1", bank_id: "b1", entity: "AuthService",
      category: "workflow", claim: "test", confidence: 0.9, importance: 85,
      occurrences: 2, created_at: new Date().toISOString(),
    }]);
    const repo = createReflectiveMemoryRepository(pool);
    const result = await repo.getFact("t1", "b1", "f1");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("fact");
    expect(result!.id).toBe("f1");
    expect(result!.entity).toBe("AuthService");
  });

  it("listFacts returns array of Facts", async () => {
    const pool: any = fakePool([
      { id: "f1", tenant_id: "t1", bank_id: "b1", entity: "A", category: "workflow", claim: "c1", confidence: 0.8, importance: 50, occurrences: 1, created_at: new Date().toISOString() },
      { id: "f2", tenant_id: "t1", bank_id: "b1", entity: "B", category: "failure", claim: "c2", confidence: 0.7, importance: 60, occurrences: 2, created_at: new Date().toISOString() },
    ]);
    const repo = createReflectiveMemoryRepository(pool);
    const results = await repo.listFacts("t1", "b1");
    expect(results).toHaveLength(2);
    expect(results[0].kind).toBe("fact");
    expect(results[1].kind).toBe("fact");
  });

  it("createInsight issues INSERT INTO insights", async () => {
    const pool: any = fakePool();
    const repo = createReflectiveMemoryRepository(pool);
    const insight = createInsight({ id: "i1", tenantId: "t1", bankId: "b1", type: "pattern", depth: 1, claim: "test insight", supportingNodes: ["f1"] });
    await repo.createInsight(insight);
    const insert = pool.seen.find((s: any) => /INSERT INTO insights/i.test(s.text));
    expect(insert).toBeDefined();
    expect(insert.params[0]).toBe("i1");
    expect(insert.params[1]).toBe("t1");
    expect(insert.params[2]).toBe("b1");
  });

  it("getInsight returns null when no rows", async () => {
    const pool: any = fakePool([]);
    const repo = createReflectiveMemoryRepository(pool);
    const result = await repo.getInsight("t1", "b1", "nonexistent");
    expect(result).toBeNull();
  });

  it("getInsight returns an Insight when row exists", async () => {
    const pool: any = fakePool([{
      id: "i1", tenant_id: "t1", bank_id: "b1", type: "pattern", depth: 1,
      claim: "test insight", supporting_nodes: ["f1"], contradicting_nodes: [],
      confidence: 0.7, stability: 0.5, predictive_value: null,
      parent_insights: [], status: "candidate", prediction_count: 0,
      correct_predictions: 0, importance: 80, created_at: new Date().toISOString(),
      last_validated_at: new Date().toISOString(),
    }]);
    const repo = createReflectiveMemoryRepository(pool);
    const result = await repo.getInsight("t1", "b1", "i1");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("insight");
    expect(result!.type).toBe("pattern");
    expect(result!.status).toBe("candidate");
  });

  it("listInsights returns array of Insights", async () => {
    const pool: any = fakePool([
      { id: "i1", tenant_id: "t1", bank_id: "b1", type: "pattern", depth: 1, claim: "c1", supporting_nodes: [], contradicting_nodes: [], confidence: 0.7, stability: 0.5, predictive_value: null, parent_insights: [], status: "active", prediction_count: 0, correct_predictions: 0, importance: 80, created_at: new Date().toISOString(), last_validated_at: new Date().toISOString() },
    ]);
    const repo = createReflectiveMemoryRepository(pool);
    const results = await repo.listInsights("t1", "b1");
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("insight");
  });

  it("getNode returns Fact when fact exists", async () => {
    const pool: any = fakePool([{
      id: "f1", tenant_id: "t1", bank_id: "b1", entity: "A", category: "workflow",
      claim: "c1", confidence: 0.8, importance: 50, occurrences: 1,
      created_at: new Date().toISOString(),
    }]);
    // First call (getFact) returns the fact, second call (getInsight) returns empty
    let callCount = 0;
    pool.query = async (text: string, params: any[] = []) => {
      callCount++;
      if (callCount === 1) return { rows: [pool._rows[0]] };
      return { rows: [] };
    };
    pool._rows = pool.seen.length > 0 ? [] : [];
    const repo = createReflectiveMemoryRepository(pool);
    // Reset pool to return fact on first query, empty on second
    let q = 0;
    pool.query = async () => {
      q++;
      if (q === 1) return { rows: [{ id: "f1", tenant_id: "t1", bank_id: "b1", entity: "A", category: "workflow", claim: "c1", confidence: 0.8, importance: 50, occurrences: 1, created_at: new Date().toISOString() }] };
      return { rows: [] };
    };
    const result = await repo.getNode("t1", "b1", "f1");
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("fact");
  });

  it("listNodes returns combined facts and insights sorted by date", async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 1000);
    let q = 0;
    const pool: any = {
      seen: [],
      async query(text: string, params: any[] = []) {
        q++;
        if (q === 1) return { rows: [{ id: "f1", tenant_id: "t1", bank_id: "b1", entity: "A", category: "workflow", claim: "c1", confidence: 0.8, importance: 50, occurrences: 1, created_at: earlier.toISOString() }] };
        return { rows: [{ id: "i1", tenant_id: "t1", bank_id: "b1", type: "pattern", depth: 1, claim: "insight1", supporting_nodes: [], contradicting_nodes: [], confidence: 0.7, stability: 0.5, predictive_value: null, parent_insights: [], status: "active", prediction_count: 0, correct_predictions: 0, importance: 80, created_at: now.toISOString(), last_validated_at: now.toISOString() }] };
      },
    };
    const repo = createReflectiveMemoryRepository(pool);
    const results = await repo.listNodes("t1", "b1");
    expect(results).toHaveLength(2);
    // Most recent first
    expect(results[0].kind).toBe("insight");
    expect(results[1].kind).toBe("fact");
  });
});
