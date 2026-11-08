import { describe, expect, it } from "vitest";
import {
  saveDistilledFacts,
  loadDistilledFacts,
  markSuperseded,
  factIdFor,
} from "../pg-lifecycle";

function fakePool(seedRows: any[] = []) {
  const seen: { text: string; params: any[] }[] = [];
  return {
    seen,
    async query(text: string, params: any[] = []) {
      seen.push({ text, params });
      if (/^SELECT/i.test(text.trim())) return { rows: seedRows };
      return { rows: [] };
    },
  };
}

const TENANT = "sandbox-tenant";

describe("pg unified canonical store", () => {
  it("fact id is deterministic per entity+content", () => {
    expect(factIdFor("AuthService", "x")).toBe(factIdFor("AuthService", "x"));
    expect(factIdFor("AuthService", "x")).not.toBe(factIdFor("AuthService", "y"));
  });

  it("saves to canonical facts table with tenant scope", async () => {
    const pool: any = fakePool();
    await saveDistilledFacts(pool, TENANT, "bank1", [
      { entity: "AuthService", category: "workflow", content: "x", confidence: 0.9, importance: 85, occurrences: 2 },
    ]);
    const insert = pool.seen.find((s: any) => /INSERT INTO facts/i.test(s.text));
    expect(insert).toBeDefined();
    expect(insert.params[1]).toBe(TENANT);
    expect(insert.params[2]).toBe("bank1");
  });

  it("saves provenance to evidence table", async () => {
    const pool: any = fakePool();
    await saveDistilledFacts(pool, TENANT, "bank1", [
      { entity: "A", category: "workflow", content: "y", confidence: 0.8, importance: 60, occurrences: 1, provenance: { source: "nightly", createdAt: 5 } },
    ]);
    const ev = pool.seen.find((s: any) => /INSERT INTO evidence/i.test(s.text));
    expect(ev).toBeDefined();
    expect(JSON.stringify(ev.params)).toMatch(/nightly/);
  });

  it("loads facts back joined with latest provenance", async () => {
    const pool: any = fakePool([
      { entity: "AuthService", content: "x", confidence: 0.9, importance: 85, occurrences: 2, provenance: { source: "nightly", createdAt: 1 } },
    ]);
    const consultant = (await import("../pg-lifecycle")).loadDistilledFacts;
    const facts = await consultant(pool, TENANT, "bank1");
    expect(pool.seen[0].text).toMatch(/FROM facts/i);
    expect(facts[0].entity).toBe("AuthService");
  });

  it("supersede writes a tombstone row", async () => {
    const pool: any = {
      seen: [] as any[],
      async query(text: string, params: any[] = []) {
        (this as any).seen.push({ text, params });
        if (/^SELECT/i.test(text.trim())) return { rows: [{ id: "df-authservice-x" }] };
        return { rows: [] };
      },
    };
    await markSuperseded(pool, TENANT, "bank1", "AuthService", "df-new");
    const tomb = pool.seen.find((s: any) => /deleted_facts|tombstone/i.test(s.text));
    expect(tomb).toBeDefined();
  });
});
