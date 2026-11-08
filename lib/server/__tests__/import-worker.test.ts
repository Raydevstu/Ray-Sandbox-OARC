import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { importOnce } from "../import-worker";

describe("import worker", () => {
  it("imports new md files into distilled facts and returns hashes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "imp-"));
    writeFileSync(join(dir, "note.md"), "AuthService uses httpOnly cookies for sessions");
    const saved: any[] = [];
    const pool: any = {
      async query(text: string, params: any[] = []) {
        if (/INSERT INTO facts/i.test(text)) saved.push(params);
        if (/^SELECT/i.test(text.trim())) return { rows: [] };
        return { rows: [] };
      },
    };
    const out = await importOnce(pool, "sandbox-tenant", "bank1", dir, []);
    expect(out.imported).toBe(1);
    expect(out.hashes.length).toBe(1);
    expect(saved.length).toBeGreaterThan(0);
    expect(JSON.stringify(saved)).toMatch(/httpOnly|fact-/);
  });

  it("skips already-imported files on second run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "imp2-"));
    writeFileSync(join(dir, "note.md"), "stable content here");
    const pool: any = { async query() { return { rows: [] }; } };
    const first = await importOnce(pool, "t", "b", dir, []);
    const second = await importOnce(pool, "t", "b", dir, first.hashes);
    expect(first.imported).toBe(1);
    expect(second.imported).toBe(0);
  });
});
