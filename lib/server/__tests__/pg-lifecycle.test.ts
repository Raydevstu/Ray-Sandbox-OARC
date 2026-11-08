import { describe, expect, it } from "vitest";
import {
  DISTILLED_FACTS_DDL,
  DECISION_TRACES_DDL,
  saveDistilledFacts,
  deleteChatSessionFacts,
  loadDistilledFacts,
  saveDecisionTrace,
  loadDecisionTraces,
  traceAcceptance,
} from "../pg-lifecycle";

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

describe("pg lifecycle store", () => {
  it("DDL covers canonical facts, evidence, tombstones and traces", () => {
    expect(DISTILLED_FACTS_DDL).toMatch(/CREATE TABLE IF NOT EXISTS facts/);
    expect(DISTILLED_FACTS_DDL).toMatch(/CREATE TABLE IF NOT EXISTS evidence/);
    expect(DISTILLED_FACTS_DDL).toMatch(/deleted_facts/);
    expect(DECISION_TRACES_DDL).toMatch(/decision_traces/);
    expect(DECISION_TRACES_DDL).toMatch(/query_hash/);
  });

  it("saves distilled facts to canonical facts table", async () => {
    const pool: any = fakePool();
    await saveDistilledFacts(pool, "t1", "bank1", [
      { entity: "AuthService", category: "workflow", content: "x", confidence: 0.9, importance: 85, occurrences: 2 },
    ]);
    const insert = pool.seen.find((s: any) => /INSERT INTO facts/i.test(s.text));
    expect(insert).toBeDefined();
    expect(insert.params[0]).toMatch(/^df-authservice-/);
    expect(insert.params[1]).toBe("t1");
    expect(insert.params[2]).toBe("bank1");
  });

  it("loads distilled facts back into shape", async () => {
    const pool: any = fakePool([
      { entity: "AuthService", category: "workflow", content: "x", confidence: 0.9, importance: 85, occurrences: 2, provenance: { source: "nightly", createdAt: 1 } },
    ]);
    const facts = await loadDistilledFacts(pool, "t1", "bank1");
    expect(pool.seen[0].text).toMatch(/FROM facts/i);
    expect(facts.length).toBe(1);
    expect(facts[0].entity).toBe("AuthService");
    expect((facts[0] as any).provenance.source).toBe("nightly");
  });

  it("saves decision trace without raw content", async () => {
    const pool: any = fakePool();
    await saveDecisionTrace(pool, "t1", "bank1", {
      id: "t1", queryHash: "ab12", task: "fix login", model: "local", tokens: 10,
      items: [{ entity: "AuthService", score: 5, why: "keyword+2", contentHash: "ff", contentLength: 9 }],
      createdAt: 1,
    } as any);
    const blob = JSON.stringify(pool.seen);
    expect(pool.seen[0].text).toMatch(/INSERT INTO decision_traces/);
    expect(blob).not.toMatch(/secret/);
  });

  it("acceptance rate counts accepted over decided", async () => {
    const pool: any = fakePool([{ accepted: 2, decided: 3 }]);
    expect(await traceAcceptance(pool, "t1", "bank1")).toBeCloseTo(0.66, 1);
  });

  it("acceptance is 0 when no traces", async () => {
    const pool: any = fakePool([{ accepted: 0, decided: 0 }]);
    expect(await traceAcceptance(pool, "t1", "bank1")).toBe(0);
  });

  it("deletes chat session facts by turnId with resync-safe SQL", async () => {
    const pool: any = fakePool([{ id: "df-x-1" }, { id: "df-x-2" }]);
    const n = await deleteChatSessionFacts(pool, "t1", "bank1", "sess-9");
    expect(n).toBe(2);
    const blob = JSON.stringify(pool.seen);
    expect(blob).toMatch(/provenance::jsonb/);
    expect(blob).toMatch(/DELETE FROM facts/);
    expect(pool.seen[0].params).toEqual(["t1", "bank1", ["hermes-push", "hermes-sync"], "sess-9"]);
  });

  it("delete is a no-op when the session has no facts", async () => {
    const pool: any = fakePool([]);
    expect(await deleteChatSessionFacts(pool, "t1", "bank1", "sess-9")).toBe(0);
    expect(pool.seen).toHaveLength(1);
  });
});
