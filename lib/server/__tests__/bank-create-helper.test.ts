import { describe, expect, it } from "vitest";
import { parseBankBody } from "../bank-create-helper";

describe("bank create helper", () => {
  it("parses name with optional watch path", () => {
    expect(parseBankBody({ name: "proj", watchPath: "/docs" })).toEqual({ name: "proj", watchPath: "/docs", hermesCwd: "" });
  });

  it("watch path is optional", () => {
    expect(parseBankBody({ name: "proj" })).toEqual({ name: "proj", watchPath: "", hermesCwd: "" });
  });

  it("accepts hermes cwd for chat sync", () => {
    expect(parseBankBody({ name: "proj", hermesCwd: "D:\\Projects\\Demo" })).toEqual({ name: "proj", watchPath: "", hermesCwd: "D:\\Projects\\Demo" });
  });

  it("rejects empty name", () => {
    expect(() => parseBankBody({ name: " " })).toThrow(/name/);
  });
});
