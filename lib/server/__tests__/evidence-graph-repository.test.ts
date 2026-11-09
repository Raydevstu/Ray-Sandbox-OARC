import { describe, expect, it } from "vitest";
import { createEvidenceGraphRepository } from "../evidence-graph-repository";
import { createEvidenceLink } from "../../engine/reflective-memory-types";

function fakePool(rows: any[] = []) {
  const seen: { text: string; params: any[] }[] = [];
  const pool: any = {
    seen,
    _queryFn: null as ((text: string, params: any[]) => { rows: any[] }) | null,
    async query(text: string, params: any[] = []) {
      seen.push({ text, params });
      if (pool._queryFn) return pool._queryFn(text, params);
      return { rows };
    },
  };
  return pool;
}

describe("evidence-graph-repository", () => {
  it("createLink issues INSERT INTO evidence_links", async () => {
    const pool: any = fakePool();
    pool._queryFn = () => ({ rows: [] });
    // nodeExists always returns true
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const link = createEvidenceLink({ id: "e1", sourceNodeId: "f1", targetNodeId: "i1", relation: "supports" });
    await repo.createLink(link, "t1", "b1");
    const insert = pool.seen.find((s: any) => /INSERT INTO evidence_links/i.test(s.text));
    expect(insert).toBeDefined();
    expect(insert.params[0]).toBe("e1");
  });

  it("createLink rejects when source node does not exist (G1)", async () => {
    const pool: any = fakePool();
    pool._queryFn = () => ({ rows: [] });
    const repo = createEvidenceGraphRepository(pool, async (_t, _b, nodeId) => nodeId === "i1");
    const link = createEvidenceLink({ id: "e2", sourceNodeId: "nonexistent", targetNodeId: "i1", relation: "supports" });
    await expect(repo.createLink(link, "t1", "b1")).rejects.toThrow("does not exist");
  });

  it("createLink rejects when target node does not exist (G1)", async () => {
    const pool: any = fakePool();
    pool._queryFn = () => ({ rows: [] });
    const repo = createEvidenceGraphRepository(pool, async (_t, _b, nodeId) => nodeId === "f1");
    const link = createEvidenceLink({ id: "e3", sourceNodeId: "f1", targetNodeId: "nonexistent", relation: "supports" });
    await expect(repo.createLink(link, "t1", "b1")).rejects.toThrow("does not exist");
  });

  it("getLink returns null when no rows", async () => {
    const pool: any = fakePool([]);
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const result = await repo.getLink("t1", "b1", "nonexistent");
    expect(result).toBeNull();
  });

  it("getLink returns an EvidenceLink when row exists", async () => {
    const pool: any = fakePool([{
      id: "e1", source_node_id: "f1", target_node_id: "i1", relation: "supports",
      weight: 1.0, created_at: new Date().toISOString(),
    }]);
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const result = await repo.getLink("t1", "b1", "e1");
    expect(result).not.toBeNull();
    expect(result!.relation).toBe("supports");
    expect(result!.sourceNodeId).toBe("f1");
  });

  it("deleteLink issues DELETE FROM evidence_links", async () => {
    const pool: any = fakePool();
    pool._queryFn = () => ({ rows: [] });
    const repo = createEvidenceGraphRepository(pool, async () => true);
    await repo.deleteLink("t1", "b1", "e1");
    const del = pool.seen.find((s: any) => /DELETE FROM evidence_links/i.test(s.text));
    expect(del).toBeDefined();
  });

  it("getSupportingEvidence filters by relation=supports", async () => {
    const pool: any = fakePool();
    pool._queryFn = () => ({ rows: [] });
    const repo = createEvidenceGraphRepository(pool, async () => true);
    await repo.getSupportingEvidence("t1", "b1", "i1");
    const q = pool.seen.find((s: any) => /relation = 'supports'/i.test(s.text));
    expect(q).toBeDefined();
    expect(q.params[2]).toBe("i1");
  });

  it("getContradictingEvidence filters by relation=contradicts", async () => {
    const pool: any = fakePool();
    pool._queryFn = () => ({ rows: [] });
    const repo = createEvidenceGraphRepository(pool, async () => true);
    await repo.getContradictingEvidence("t1", "b1", "i1");
    const q = pool.seen.find((s: any) => /relation = 'contradicts'/i.test(s.text));
    expect(q).toBeDefined();
  });

  it("getEvidenceSubgraph returns nodeIds and linkIds", async () => {
    // Mock: node "i1" has one outgoing link to "f1"
    const pool: any = fakePool();
    let callCount = 0;
    pool._queryFn = (text: string, params: any[]) => {
      callCount++;
      if (text.includes("source_node_id = $3") || text.includes("target_node_id = $3")) {
        // listLinksForNode returns a link between i1 and f1
        if (params[2] === "i1") {
          return { rows: [{ id: "e1", source_node_id: "i1", target_node_id: "f1", relation: "supports", weight: 1.0, created_at: new Date().toISOString() }] };
        }
      }
      return { rows: [] };
    };
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const subgraph = await repo.getEvidenceSubgraph("t1", "b1", "i1", 2);
    expect(subgraph.nodeIds).toContain("i1");
    expect(subgraph.nodeIds).toContain("f1");
    expect(subgraph.linkIds).toContain("e1");
  });

  it("getEvidenceSubgraph respects maxDepth", async () => {
    const pool: any = fakePool();
    pool._queryFn = (text: string, params: any[]) => {
      if (params[2] === "i1") {
        return { rows: [{ id: "e1", source_node_id: "i1", target_node_id: "f1", relation: "supports", weight: 1.0, created_at: new Date().toISOString() }] };
      }
      if (params[2] === "f1") {
        return { rows: [{ id: "e2", source_node_id: "f1", target_node_id: "f2", relation: "supports", weight: 1.0, created_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    };
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const subgraph = await repo.getEvidenceSubgraph("t1", "b1", "i1", 1);
    // maxDepth=1: should include i1 and f1, but NOT f2
    expect(subgraph.nodeIds).toContain("i1");
    expect(subgraph.nodeIds).toContain("f1");
    expect(subgraph.nodeIds).not.toContain("f2");
  });

  it("wouldCreateCycle detects cycle", async () => {
    // A -> B already exists (derivedFrom). Adding B -> A should create cycle.
    const pool: any = fakePool();
    pool._queryFn = (text: string, params: any[]) => {
      // listOutgoingLinks for B returns link to A
      if (text.includes("source_node_id = $3") && params[2] === "B") {
        return { rows: [{ id: "e1", source_node_id: "B", target_node_id: "A", relation: "derivedFrom", weight: 1.0, created_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    };
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const cycle = await repo.wouldCreateCycle("t1", "b1", "A", "B");
    // Adding A->B when B->A exists = cycle
    expect(cycle).toBe(true);
  });

  it("wouldCreateCycle returns false when no cycle", async () => {
    const pool: any = fakePool();
    pool._queryFn = () => ({ rows: [] });
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const cycle = await repo.wouldCreateCycle("t1", "b1", "A", "B");
    expect(cycle).toBe(false);
  });

  it("createLink with derivedFrom rejects cycle", async () => {
    const pool: any = fakePool();
    pool._queryFn = (text: string, params: any[]) => {
      if (text.includes("source_node_id = $3") && params[2] === "B") {
        return { rows: [{ id: "e1", source_node_id: "B", target_node_id: "A", relation: "derivedFrom", weight: 1.0, created_at: new Date().toISOString() }] };
      }
      return { rows: [] };
    };
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const link = createEvidenceLink({ id: "e2", sourceNodeId: "A", targetNodeId: "B", relation: "derivedFrom" });
    await expect(repo.createLink(link, "t1", "b1")).rejects.toThrow("cycle");
  });

  it("findOrphanInsights returns active insights with no supporting links", async () => {
    const pool: any = fakePool([{ id: "i_orphan" }]);
    const repo = createEvidenceGraphRepository(pool, async () => true);
    const orphans = await repo.findOrphanInsights("t1", "b1");
    expect(orphans).toContain("i_orphan");
  });
});
