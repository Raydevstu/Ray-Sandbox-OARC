import { describe, expect, it } from "vitest";

import { runCodexIntegrationProof } from "../../scripts/codex-integration-proof.mjs";

const baseConfig = {
  baseUrl: "http://staging.test",
  scope: { tenantId: "test-tenant", bankId: "test-bank", projectId: "test-project" },
  conversationId: "test-conversation",
  fetcher: async () => new Response(JSON.stringify({ ok: true, data: { queued: true } }), { status: 200 }),
};

describe("Codex integration proof", () => {
  it("reports completed only after synthetic user and assistant capture, duplicate rejection, scope denial, worker completion, and protected readback", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.includes("/scope-denial")) return new Response(JSON.stringify({ ok: false, error: "scope denied" }), { status: 403 });
      if (url.includes("/worker")) return new Response(JSON.stringify({ ok: true, data: { state: "complete" } }), { status: 200 });
      if (url.includes("/readback")) return new Response(JSON.stringify({ ok: true, data: { records: 2, evidence: 2 } }), { status: 200 });
      const duplicate = requests.filter((request) => request.url.includes("/capture")).length > 2;
      return new Response(JSON.stringify({ ok: true, data: { queued: !duplicate, duplicate } }), { status: 200 });
    };

    const result = await runCodexIntegrationProof({ ...baseConfig, fetcher });

    expect(result).toMatchObject({ status: "completed", capturedRoles: ["user", "assistant"], redacted: true, duplicateSafe: true, scopeDenied: true, workerState: "complete", readbackRecords: 2 });
    expect(requests.map((request) => JSON.stringify(request.init?.body)).join("\n")).not.toContain("synthetic-secret");
    expect(requests.map((request) => JSON.stringify(request.init?.body)).join("\n")).not.toContain("transcript_path");
  });

  it("keeps queued worker state explicit", async () => {
    const fetcher = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/worker")) return new Response(JSON.stringify({ ok: true, data: { state: "queued" } }), { status: 200 });
      if (url.includes("/scope-denial")) return new Response(JSON.stringify({ ok: false, error: "scope denied" }), { status: 403 });
      if (url.includes("/readback")) return new Response(JSON.stringify({ ok: true, data: { records: 0, evidence: 0 } }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, data: { queued: true, duplicate: false } }), { status: 200 });
    };

    await expect(runCodexIntegrationProof({ ...baseConfig, fetcher })).resolves.toMatchObject({ status: "queued", workerState: "queued" });
  });
});
