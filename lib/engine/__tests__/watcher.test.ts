import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { scanDir, filterNew, buildRetainText } from "../auto-import";

function makeTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "watch-"));
  writeFileSync(join(dir, "a.md"), "# hello world");
  writeFileSync(join(dir, "skip.js"), "console.log(1)");
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "sub", "b.txt"), "notes here");
  mkdirSync(join(dir, "node_modules"));
  writeFileSync(join(dir, "node_modules", "x.md"), "ignored");
  return dir;
}

describe("auto-import watcher", () => {
  it("scanDir finds md/txt and skips code and vendored dirs", () => {
    const files = scanDir(makeTree());
    const names = files.map((f) => f.path.split(/[/\\]/).pop());
    expect(names).toContain("a.md");
    expect(names).toContain("b.txt");
    expect(names).not.toContain("skip.js");
    expect(names).not.toContain("x.md");
  });

  it("scanDir hashes content deterministically", () => {
    const dir = makeTree();
    const h1 = scanDir(dir).find((f) => f.path.endsWith("a.md"))!.hash;
    const h2 = scanDir(dir).find((f) => f.path.endsWith("a.md"))!.hash;
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    expect(h1).toBe(h2);
  });

  it("filterNew drops already-imported hashes", () => {
    const files = [
      { path: "a.md", hash: "h1", size: 1, mtimeMs: 1 },
      { path: "b.md", hash: "h2", size: 1, mtimeMs: 1 },
    ];
    expect(filterNew(files, ["h1"]).map((f) => f.path)).toEqual(["b.md"]);
  });

  it("buildRetainText wraps file content for the retain pipeline", () => {
    const t = buildRetainText({ path: "docs/a.md", hash: "h", size: 5, mtimeMs: 1 }, "# hello");
    expect(t).toMatch(/docs\/a\.md/);
    expect(t).toMatch(/# hello/);
  });
});
