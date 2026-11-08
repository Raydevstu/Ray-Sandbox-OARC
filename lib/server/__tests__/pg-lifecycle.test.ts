import { describe, expect, it } from "vitest";
import {
  DISTILLED_FACTS_DDL,
  DECISION_TRACES_DDL,
  saveDistilledFacts,
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
  it("DDL covers distilled facts and decision traces", () => {
    expect(DISTILLED_FACTS_DDL).toMatch(/distilled_facts/);
    expect(DISTILLED_FACTS_DDL).toMatch(/provenance/);
    expect(DECISION_TRACES_DDL).toMatch(/decision_traces/);
    expect(DECISION_TRACES_DDL).toMatch(/query_hash/);
  });

  it("saves distilled facts with provenance JSONB", async () => {
    const pool: any = fakePool();
    await saveDistilledFacts(pool, "bank1", [
      { entity: "AuthService", category: "workflow", content: "x", confidence: 0.9, importance: 85, occurrences: 2 },
    ]);
    expect(pool.seen.length).toBe(1);
    expect(pool.seen[0].text).toMatch(/INSERT INTO distilled_facts/);
    expect(pool.seen[0].params[1]).toBe("bank1");
    expect(pool.seen[0].params[2]).toBe("AuthService");
  });

  it("loads distilled facts back into shape", async () => {
    const pool: any = fakePool([
      { entity: "AuthService", category: "workflow", content: "x", confidence: 0.9, importance: 85, occurrences: 2, provenance: { source: "nightly", createdAt: 1 } },
    ]);
    const facts = await loadDistilledFacts(pool, "bank1");
    expect(facts.length).toBe(1);
    expect(facts[0].entity).toBe("AuthService");
    expect((facts[0] as any).provenance.source).toBe("nightly");
  });

  it("saves decision trace without raw content", async () => {
    const pool: any = fakePool();
    await saveDecisionTrace(pool, "bank1", {
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
    expect(await traceAcceptance(pool, "bank1")).toBeCloseTo(0.66, 1);
  });

  it("acceptance is 0 when no traces", async () => {
    const pool: any = fakePool([{ accepted: 0, decided: 0 }]);
    expect(await traceAcceptance(pool, "bank1")).toBe(0);
  });
});
