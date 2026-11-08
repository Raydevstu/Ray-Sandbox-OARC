import { describe, expect, it } from "vitest";
import { readProjectScope } from "../api-handlers";

function req(body: any, headers: Record<string, string> = {}): Request {
  return new Request("http://local/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("readProjectScope dev fallback", () => {
  it("prefers explicit body scope", async () => {
    const s = await readProjectScope(req({ tenantId: "t", bankId: "b", projectId: "p" }));
    expect(s).toEqual({ tenantId: "t", bankId: "b", projectId: "p" });
  });

  it("falls back to dev headers when body scope is absent", async () => {
    const s = await readProjectScope(req({}, {
      "x-dev-tenant-id": "t1",
      "x-dev-bank-id": "b1",
      "x-dev-project-id": "p1",
    }));
    expect(s).toEqual({ tenantId: "t1", bankId: "b1", projectId: "p1" });
  });

  it("still rejects when neither is present", async () => {
    await expect(readProjectScope(req({}))).rejects.toThrow(/scope/);
  });
});
