import { writeFileSync } from "node:fs";

const SYNTHETIC_SECRET = "synthetic-secret";
const SYNTHETIC_TRANSCRIPT_PATH = "C:\\private\\synthetic-transcript.jsonl";

export function redactText(value) {
  return String(value)
    .replace(/(api[_-]?key|authorization|token|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED_SECRET]")
    .replace(/transcript[_-]?path\s*[:=]\s*[^\s,;]+/gi, "transcript=[REDACTED_SECRET]");
}

async function requestJson(fetcher, url, init) {
  const response = await fetcher(url, init);
  let body = {};
  try { body = await response.json(); } catch { body = {}; }
  return { response, body };
}

export async function runCodexIntegrationProof(config) {
  const fetcher = config.fetcher ?? fetch;
  const endpoints = {
    capture: "/capture",
    scopeDenial: "/scope-denial",
    worker: "/worker",
    readback: "/readback",
    ...config.endpoints,
  };
  const scope = config.scope;
  const headers = { "content-type": "application/json", ...(config.headers ?? {}), ...(config.authorization ? { authorization: config.authorization } : {}) };
  const roles = ["user", "assistant"];
  const captureResponses = [];
  let redacted = true;

  for (const [index, role] of roles.entries()) {
    const content = redactText(`Synthetic Codex ${role} message apiKey=${SYNTHETIC_SECRET} transcript_path=${SYNTHETIC_TRANSCRIPT_PATH}`);
    const payload = { ...scope, conversationId: config.conversationId, messageId: `${config.conversationId}-${index + 1}`, timestamp: new Date(0).toISOString(), kind: "mcp-call", method: "conversation/message", name: "codex-integration-proof", role, content };
    const serialized = JSON.stringify(payload);
    redacted = redacted && !serialized.includes(SYNTHETIC_SECRET) && !serialized.includes(SYNTHETIC_TRANSCRIPT_PATH) && serialized.includes("[REDACTED_SECRET]");
    const result = await requestJson(fetcher, `${config.baseUrl}${endpoints.capture}`, { method: "POST", headers, body: serialized });
    if (!result.response.ok || !result.body.ok) return { status: "failed", capturedRoles: captureResponses, redacted, error: result.body.error ?? `capture HTTP ${result.response.status}` };
    captureResponses.push({ role, ...result.body.data });
  }

  const duplicatePayload = { ...scope, conversationId: config.conversationId, messageId: `${config.conversationId}-1`, timestamp: new Date(0).toISOString(), kind: "mcp-call", method: "conversation/message", name: "codex-integration-proof", role: "user", content: "Synthetic duplicate delivery" };
  const duplicate = await requestJson(fetcher, `${config.baseUrl}${endpoints.capture}`, { method: "POST", headers, body: JSON.stringify(duplicatePayload) });
  const duplicateSafe = duplicate.response.ok && duplicate.body.ok && duplicate.body.data?.duplicate === true;

  const scopeProbe = await requestJson(fetcher, `${config.baseUrl}${endpoints.scopeDenial}?tenantId=${encodeURIComponent(scope.tenantId)}&bankId=${encodeURIComponent(scope.bankId)}&projectId=other-project`, { method: "GET", headers });
  const scopeDenied = scopeProbe.response.status === 401 || scopeProbe.response.status === 403 || scopeProbe.body?.error?.toLowerCase?.().includes("scope");

  const worker = await requestJson(fetcher, `${config.baseUrl}${endpoints.worker}?tenantId=${encodeURIComponent(scope.tenantId)}&bankId=${encodeURIComponent(scope.bankId)}&projectId=${encodeURIComponent(scope.projectId)}`, { method: "GET", headers });
  const workerState = worker.body?.data?.state === "processed" ? "complete" : worker.body?.data?.state ?? "failed";
  if (!worker.response.ok || !["queued", "complete", "processed"].includes(workerState)) return { status: "failed", capturedRoles: roles, redacted, duplicateSafe, scopeDenied, workerState, error: worker.body?.error ?? "invalid worker state" };
  if (workerState === "queued") return { status: "queued", capturedRoles: roles, redacted, duplicateSafe, scopeDenied, workerState };

  const readback = await requestJson(fetcher, `${config.baseUrl}${endpoints.readback}?tenantId=${encodeURIComponent(scope.tenantId)}&bankId=${encodeURIComponent(scope.bankId)}&projectId=${encodeURIComponent(scope.projectId)}`, { method: "GET", headers });
  const audit = readback.body?.data?.audit;
  const readbackRecords = Number(readback.body?.data?.records ?? audit?.total ?? audit?.records?.length ?? 0);
  const readbackEvidence = Number(readback.body?.data?.evidence ?? audit?.records?.filter((record) => Array.isArray(record.evidence) && record.evidence.length > 0).length ?? 0);
  if (!readback.response.ok || !readback.body.ok || readbackRecords < roles.length || readbackEvidence < roles.length) return { status: "failed", capturedRoles: roles, redacted, duplicateSafe, scopeDenied, workerState, readbackRecords, readbackEvidence, error: readback.body?.error ?? "durable readback incomplete" };
  return { status: "completed", capturedRoles: roles, redacted, duplicateSafe, scopeDenied, workerState, readbackRecords, readbackEvidence };
}

if (process.argv[1]?.endsWith("codex-integration-proof.mjs")) {
  if (process.env.NODE_ENV === "production") throw new Error("Codex integration proof is local/staging-only");
  const scope = { tenantId: process.env.CODEX_PROOF_TENANT_ID, bankId: process.env.CODEX_PROOF_BANK_ID, projectId: process.env.CODEX_PROOF_PROJECT_ID };
  if (Object.values(scope).some((value) => !value)) throw new Error("Provide CODEX_PROOF_TENANT_ID, CODEX_PROOF_BANK_ID, and CODEX_PROOF_PROJECT_ID");
  const result = await runCodexIntegrationProof({
    baseUrl: process.env.CODEX_PROOF_BASE_URL ?? "http://127.0.0.1:3028",
    authorization: process.env.CODEX_PROOF_AUTHORIZATION,
    scope,
    conversationId: process.env.CODEX_PROOF_CONVERSATION_ID ?? `codex-proof-${Date.now()}`,
    headers: { "x-dev-subject": "codex-proof", "x-dev-tenant-id": scope.tenantId, "x-dev-scopes": "events:write memory:read memory:write" },
    endpoints: { capture: "/api/project-memory/codex-event", scopeDenial: "/api/project-memory/events", worker: "/api/project-memory/status", readback: "/api/project-memory/audit" },
  });
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (output) writeFileSync(output, serialized, "utf8");
  process.stdout.write(serialized);
  if (result.status === "failed") process.exitCode = 1;
}
