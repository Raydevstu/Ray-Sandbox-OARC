import { describe, expect, it } from "vitest";
import { resolveWatchPath, listWatchTargets } from "../watcher-loop";

describe("watcher loop", () => {
  it("resolves relative paths under the projects root", () => {
    expect(resolveWatchPath("/projects", "demo")).toBe("/projects/demo");
    expect(resolveWatchPath("/projects", "/projects/demo")).toBe("/projects/demo");
  });

  it("rejects path escape outside the root", () => {
    expect(resolveWatchPath("/projects", "../etc")).toBeNull();
    expect(resolveWatchPath("/projects", "/etc/passwd")).toBeNull();
  });

  it("lists watch targets from bank records", () => {
    const targets = listWatchTargets("/projects", [
      { bankId: "demo", path: "demo" },
      { bankId: "nope", path: "" },
      { bankId: "evil", path: "../x" },
    ]);
    expect(targets).toEqual([{ bankId: "demo", dir: "/projects/demo", cwdKey: null }]);
  });

  it("carries the recorded hermes cwd through", () => {
    const targets = listWatchTargets("/projects", [
      { bankId: "demo", path: "demo", cwd: "D:\\Projects\\Demo" },
    ]);
    expect(targets).toEqual([{ bankId: "demo", dir: "/projects/demo", cwdKey: "d:/projects/demo" }]);
  });
});
