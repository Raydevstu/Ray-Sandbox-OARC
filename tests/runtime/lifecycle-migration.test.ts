import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const MIGRATION = join(process.cwd(), "db", "migrations", "0017_distilled_lifecycle_columns.sql");

describe("lifecycle columns migration", () => {
  it("migration file exists", () => {
    expect(existsSync(MIGRATION)).toBe(true);
  });

  it("covers every column hand-applied to the live db", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    for (const col of [
      "facts", "entity", "category", "importance", "occurrences",
      "evidence",
      "deleted_facts", "superseded_by",
      "decision_traces", "tenant_id",
      "idx_facts_entity", "idx_decision_traces_bank",
    ]) {
      expect(sql).toMatch(new RegExp(col));
    }
  });

  it("is idempotent (IF NOT EXISTS everywhere)", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const adds = sql.match(/ADD COLUMN/g) ?? [];
    const safe = sql.match(/ADD COLUMN IF NOT EXISTS/g) ?? [];
    expect(adds.length).toBeGreaterThan(0);
    expect(safe.length).toBe(adds.length);
  });
});
