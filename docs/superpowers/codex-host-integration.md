# Codex host integration contract

This repository exposes a platform-neutral project-memory boundary, but it does not control any AI desktop host. A host adapter or connector must invoke the typed client or import endpoint below for automatic capture to become live.

Supported platform identifiers are `codex`, `hermes`, `openai-api`, `chatgpt`, `claude`, `gemini`, `cursor`, `terminal`, `opencode`, and `vscode`. `openai-api` means an application using the OpenAI API; `chatgpt` means the ChatGPT product. They share the same envelope, project/workspace identity, redaction, provenance, and worker pipeline. The first reusable connector helpers are available for Codex, Hermes, and OpenAI API in `lib/runtime/platform-connectors.ts`.

An OpenAI API key is not required for the memory app to store imported events. It is required only if a connector actively calls an OpenAI API. A ChatGPT desktop conversation also cannot be captured merely because the user has a ChatGPT account; it requires an approved ChatGPT export, connector, or host hook.

## Codex automatic hook

The repository includes a Codex compatibility plugin under `plugins/ray-memory`. It uses the official `UserPromptSubmit` and `Stop` lifecycle hook locations and sends redacted events to `/api/project-memory/import`. Hooks must be reviewed and trusted by the user; installing a plugin does not silently grant trust. Configure `CODEX_MEMORY_ENDPOINT`, `CODEX_MEMORY_TENANT_ID`, `CODEX_MEMORY_BANK_ID`, `CODEX_MEMORY_WORKSPACE_ID`, and, for non-local deployments, `CODEX_MEMORY_AUTHORIZATION` in the hook environment before enabling it.

For exports or connector batches, send `POST /api/project-memory/import` with `platform`, `conversationId`, `sourceReference`, `messages`, and either `projectId` or `workspaceId`. When only `workspaceId` is supplied, the server derives a stable project ID.

## Event capture

Create one `CodexHookClientConfig` per authenticated project conversation and call:

```ts
import { sendCodexMcpCall, sendCodexToolResult } from "@/lib/runtime/codex-hook-client";

await sendCodexMcpCall(config, {
  messageId,
  method: "tools/call",
  name: toolName,
  role: "assistant",
  content: redactedContent,
  arguments: redactedArguments,
});

await sendCodexToolResult(config, {
  messageId: resultMessageId,
  name: toolName,
  result: redactedResult,
});
```

The host owns event identity, redaction, authentication, and retry policy. The server owns scope checks, deterministic normalization, idempotent persistence, queueing, and capture evidence.

## Matched benchmark run

To produce a real comparison for the same Codex chat corpus, the host must execute the same prompts in randomized order across all four modes (`without-memory`, `local-memory`, `postgres-memory`, and `manifest-memory`) and then call:

```ts
import { submitCodexBenchmarkRun } from "@/lib/runtime/codex-hook-client";

await submitCodexBenchmarkRun(
  config,
  `${baseUrl}/api/project-memory/benchmark`,
  {
    id: runId,
    generatedAt: new Date().toISOString(),
    corpusId,
    modelId,
    promptVersion,
    evidence: "live-codex",
    cases,
  },
);
```

Every live-Codex case must report a non-`uncaptured` capture status. The API rejects incomplete mode coverage and false live-capture claims. The resulting run can be retrieved as JSON or exported as scoped Markdown with `format=markdown`.

For a prepared redacted run file, the repository also provides a safe submission probe:

```powershell
$env:CODEX_BENCHMARK_ENDPOINT = "http://127.0.0.1:3017/api/project-memory/benchmark"
$env:CODEX_TENANT_ID = "tenant-local"
$env:CODEX_BANK_ID = "oarc-bank"
$env:CODEX_PROJECT_ID = "project-1"
$env:CODEX_AUTHORIZATION = "Bearer <scoped-token>"
npm run benchmark:submit -- .\run.json
```

The probe never prints the authorization value or run contents; it reports only success, run ID, evidence type, and returned mode names.

## Explicit non-claim

Until a host invokes these functions, the application must be described as MCP-boundary-ready and host-adapter-ready—not as automatically capturing the surrounding Codex desktop conversation.
