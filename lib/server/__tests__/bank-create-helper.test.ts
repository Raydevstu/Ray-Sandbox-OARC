import { describe, expect, it } from "vitest";
import { parseBankBody } from "../bank-create-helper";

describe("bank create helper", () => {
  it("parses name with optional watch path", () => {
    expect(parseBankBody({ name: "proj", watchPath: "/docs" })).toEqual({ name: "proj", watchPath: "/docs" });
  });

  it("watch path is optional", () => {
    expect(parseBankBody({ name: "proj" })).toEqual({ name: "proj", watchPath: "" });
  });

  it("rejects empty name", () => {
    expect(() => parseBankBody({ name: " " })).toThrow(/name/);
  });
});
