import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../../app/api/mcp/route";

const headers = {
  "content-type": "application/json",
  "x-dev-subject": "codex-test",
  "x-dev-tenant-id": "tenant-test",
  "x-dev-scopes": "memory:read memory:write",
};

const request = (body: Record<string, unknown>) => new Request("http://localhost/api/mcp", { method: "POST", headers, body: JSON.stringify(body) });

describe("MCP JSON-RPC route", () => {
  beforeEach(() => {
    process.env.APEX_ALLOW_DEV_PRINCIPAL = "true";
  });

  it("negotiates the protocol and advertises runtime tools", async () => {
    const initialize = await POST(request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
    expect(initialize.status).toBe(200);
    expect(initialize.headers.get("MCP-Session-Id")).toBeTruthy();
    await expect(initialize.json()).resolves.toMatchObject({ result: { protocolVersion: "2025-06-18", capabilities: { tools: {} } } });

    const tools = await POST(request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
    await expect(tools.json()).resolves.toMatchObject({ result: { tools: [{ name: "memory_retain" }, { name: "memory_recall" }, { name: "memory_reflect" }, { name: "memory_update" }, { name: "memory_delete" }, { name: "memory_list_entities" }] } });
  });

  it("accepts a session-bound follow-up request", async () => {
    const initialize = await POST(request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
    const sessionId = initialize.headers.get("MCP-Session-Id");
    const response = await POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { ...headers, "mcp-session-id": sessionId ?? "" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("MCP-Session-Id")).toBe(sessionId);
  });

  it("opens an authenticated stream for a known session", async () => {
    const initialize = await POST(request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
    const sessionId = initialize.headers.get("MCP-Session-Id");
    const response = await (await import("../../app/api/mcp/route")).GET(new Request("http://localhost/api/mcp", { headers: { ...headers, "mcp-session-id": sessionId ?? "", accept: "text/event-stream" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("MCP-Session-Id")).toBe(sessionId);
  });

  it("rejects malformed JSON-RPC requests", async () => {
    const response = await POST(new Request("http://localhost/api/mcp", { method: "POST", headers, body: JSON.stringify({ method: "tools/list" }) }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: -32700 } });
  });
});
