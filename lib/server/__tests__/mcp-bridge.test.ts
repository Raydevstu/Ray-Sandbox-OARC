import { describe, expect, it } from "vitest";
import { buildHermesToolCall, bridgeUrl } from "../mcp-bridge";

describe("mcp bridge", () => {
  it("builds a Hermes-routable tool call", () => {
    const call = buildHermesToolCall("recall", { query: "login bug" });
    expect(call.tool).toBe("recall");
    expect((call.args as any).query).toBe("login bug");
    expect(call.source).toBe("hindsight-mcp");
  });

  it("no bridge URL by default", () => {
    const saved = process.env.HERMES_BRIDGE_URL;
    delete process.env.HERMES_BRIDGE_URL;
    expect(bridgeUrl()).toBeNull();
    if (saved !== undefined) process.env.HERMES_BRIDGE_URL = saved;
  });

  it("reads bridge URL from env", () => {
    process.env.HERMES_BRIDGE_URL = "http://localhost:8787/tools";
    expect(bridgeUrl()).toBe("http://localhost:8787/tools");
    delete process.env.HERMES_BRIDGE_URL;
  });
});
