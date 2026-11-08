import { describe, expect, it } from "vitest";
import { parseImportBody, nextPollIn } from "../import-route-helper";

describe("import route helper", () => {
  it("parses start action with defaults", () => {
    expect(parseImportBody({ action: "start", bankId: "b", path: "/tmp" })).toEqual({
      action: "start", bankId: "b", path: "/tmp",
    });
  });

  it("rejects unknown action", () => {
    expect(() => parseImportBody({ action: "explode" })).toThrow(/action/);
  });

  it("rejects missing path on start", () => {
    expect(() => parseImportBody({ action: "start", bankId: "b" })).toThrow(/path/);
  });

  it("poll delay is bounded", () => {
    expect(nextPollIn(100)).toBe(5000);
    expect(nextPollIn(60_000)).toBe(60_000);
  });
});
