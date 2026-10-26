# Ray Sandbox OARC — Tier-1 Competitive Upgrade Blueprint

Date: 2026-10-08  
Status: ACTIVE — PROJECT CORE HEART DOCUMENT (implementation and verification authority)  
Scope: competitive memory/agent-workspace upgrade and controlled before/after evaluation

## Executive decision

Ray Sandbox OARC already has a strong provenance-first memory model, deterministic retrieval engines, MCP JSON-RPC, durable PostgreSQL workers, governance, and an observability foundation. Its largest weakness is not another retrieval algorithm. It is the distance between those contracts and a continuously verified, operator-friendly, live Codex product.

Recommended investment order:

1. Make live capture, scope, and audit read paths observable and verifiable.
2. Add entity/run-scoped retrieval plus a composable filter DSL.
3. Turn the existing benchmark page into a reproducible with-memory/without-memory evaluation lab.
4. Add revision history, conflict review, and human feedback loops.
5. Finish the operational UI and browser E2E before adding heavier graph or chart dependencies.

The target is not “stores every message.” The target is measurable project continuity: an entering agent can recover verified decisions, requirements, evidence, risks, and next actions, while uncaptured information remains explicit.

## Implementation status

| Slice | Status | Current evidence |
|---|---|---|
| Core Heart designation | `VERIFIED` | `docs/superpowers/PROJECT-CORE-HEART.md`, this document marked authoritative |
| A — capture/runtime truth | `IMPLEMENTED / TESTED` | Capture lifecycle contract, `/api/project-memory/status`, MCP lifecycle instrumentation, focused tests |
| B — identity/filter contract | `IMPLEMENTED / TESTED` | Optional user/agent/app/run identity, fail-closed nested filter evaluator, focused tests |
| C — live evaluation lab | `IMPLEMENTED / VERIFIED` local baseline and host submission foundation, `PENDING` live quality run | Deterministic Tier-1 engine, versioned baseline JSON, four-mode result contract, PostgreSQL migration `0006`, repository storage, authenticated API, typed Codex benchmark submission adapter, and fresh-repository live persistence test pass; live Codex A/B quality measurements remain |
| D — revision/conflict review | `IMPLEMENTED / TESTED` | Explicit review service, authenticated PostgreSQL review route, and audit-surface operator controls preserve history and append review events |
| E — manifest/run inspector | `IMPLEMENTED / TESTED` foundation | Authenticated JSON/Markdown manifest, read-only historical replay via `atSequence`, scoped benchmark Markdown export, and ordered scoped event APIs replay project state; audit UI now exposes recent event history |
| F — operator UI/browser QA | `IMPLEMENTED / PARTIAL` | Local staging authenticated Chromium/mobile Playwright coverage now passes for sandbox, benchmark, audit, keyboard focus, and serious/critical axe checks at the exercised 375/1440 layouts. 768px coverage plus authenticated review/events/manifest/export journeys remain |
| G — optional scale adapters | `PENDING` | Defer until measured load or observability evidence requires them |

Latest verification gate: full test suite `128 passed / 4 skipped` across 43 passed files plus 1 skipped file, TypeScript typecheck passed, and `next build` passed. The build route inventory includes `/api/project-memory/benchmark`, `/api/project-memory/codex-event`, `/sandbox/benchmarks`, and the audit/manifest/events/review/status surfaces. PostgreSQL was reachable, canonical schema was ready, migration `0006_benchmark_runs.sql` applied, and fresh-repository benchmark persistence passed in the earlier live integration gate. The local Tier-1 baseline is versioned at `docs/benchmarks/2026-10-08-codex-baseline.json`. Build emitted only existing non-blocking ESLint directive warnings and a multiple-lockfile workspace-root warning. This does not replace live Codex capture, browser, load, restore, or production deployment evidence.

Fresh local staging evidence on 2026-10-10: `npm run staging:validate` passed health, meaningful worker ingestion, import lifecycle, worker completion, and canonical provenance. `npm run test:e2e` passed all 6 Chromium/mobile tests; serious/critical axe violations were empty, authenticated audit access passed, and keyboard focus plus 375/1440 layout checks passed. This remains local staging evidence and does not cover 768px or the full review/events/manifest/export journey.

Runtime MCP probe: an isolated local instance with explicit development-principal configuration completed JSON-RPC `initialize` and `tools/list`, exposing `memory_retain`, `memory_recall`, `memory_reflect`, `memory_update`, `memory_delete`, and `memory_list_entities`. The normal instance correctly rejected the same probe because development principals are disabled. This verifies MCP boundary reachability and security posture, not automatic capture of the surrounding Codex desktop conversation.

Runtime note: the existing long-running process on port `3017` returned a transient `500` for `/sandbox`; a clean diagnostic Next dev instance on port `3022` served it with `200`, and a later recheck confirmed `/sandbox`, `/sandbox/benchmarks`, `/sandbox/memory-audit`, and `/api/v1/health` all return `200` on `3017`. The diagnostic process was stopped; the transient was process/runtime drift, not treated as an application fix or a production claim.

Codex event-hook boundary: `POST /api/project-memory/codex-event` now accepts authenticated MCP-call/tool-result envelopes, normalizes them with deterministic provenance, persists them through the existing PostgreSQL/idempotent pipeline, and returns queued/capture evidence. The hook is tested; desktop interception still requires a host-side event adapter to call it. A 2026-10-10 synthetic UserPromptSubmit/Stop probe accepted two supplied turns and produced four durable project events, but no real multi-turn desktop Codex capture was available; retry, cancellation, tool-call, and failed-turn host evidence remain pending.

Host adapter: `lib/runtime/codex-hook-client.ts` now provides typed `sendCodexMcpCall`, `sendCodexToolResult`, and `submitCodexBenchmarkRun` functions for a Codex host/connector to call the hook and benchmark API without hand-building HTTP envelopes. The executable host contract is documented in `docs/superpowers/codex-host-integration.md`, and `npm run benchmark:submit -- <run.json>` provides a redaction-safe submission probe for prepared runs. Error handling and benchmark submission are tested; payload contents are not included in thrown errors. PostgreSQL worker restart/recovery is covered by the live integration suite for claim recovery, retry persistence, and dead-letter state across fresh repository instances.

## Current baseline

Evidence from `docs/scenario-benchmark-report.md`:

| Measure | Current result | Evidence limit |
|---|---:|---|
| Scenario pass rate | 100% | Existing local fixture, not a live Codex conversation |
| Deterministic evaluation accuracy | 92.9% | Token-overlap judge; not human or LLM judged |
| Before/after accuracy in that report | 92.9% → 92.9% | The fixture did not show an accuracy delta |
| Canonical scenario checks | 8/8 listed capabilities passed | Synthetic/local scenario |
| Published Mem0/Zep figures | 92% / 81% | Directional references, not reproduced locally |

Current implementation evidence also shows that `/api/mcp` JSON-RPC is tested, but Codex feature parity remains partial; the audit route can explicitly show an unavailable or unconfigured live PostgreSQL state; browser E2E and a live-chat capture proof are still pending. These are baseline gaps, not failures to hide.

## Competitive scan

The following are Tier-1 or adjacent reference products. Public documentation and product surfaces were used as directional evidence; vendor claims are not treated as independent proof.

| Product | Strong functionality | UI/product strength | OARC gap exposed | Adopt / reject |
|---|---|---|---|---|
| Mem0 | Scoped memory, filters, update/delete, batch operations, integrations, evaluation orientation | Clear API-first mental model | Entity/run scope, filter DSL, update history, live eval | Adopt the contracts; keep OARC provenance and append-only history |
| Zep / Graphiti | Temporal knowledge graph, entity/episode modeling, graph retrieval | Strong explanation of temporal context | Temporal graph projection and query explanation | Adopt bounded temporal/entity projection; do not add a graph DB before workload evidence |
| Letta | Stateful agents, editable memory blocks, archival memory, agent control | Excellent “agent owns memory” mental model | Explicit editable working memory and agent-facing memory controls | Adopt memory-block semantics for operator context; retain OARC governance |
| LangGraph Platform | Durable runs, checkpoints, threads, human-in-the-loop | Strong run/thread debugging model | Run identity, checkpoint inspection, replay and intervention | Adopt run/checkpoint UI and APIs |
| LlamaIndex | Ingestion pipelines, metadata filters, retrievers, evaluation tools | Broad composability | Connector and retrieval evaluation breadth | Adopt connector contract and eval schema; avoid framework lock-in |
| Pinecone Assistant / knowledge retrieval | Managed ingestion, citations, hosted retrieval | Fast time-to-value and citation UX | Citation-first response evidence and ingestion status | Adopt citation UX and ingestion state machine; do not assume hosted vendor storage |
| NotebookLM | Source-grounded synthesis, citations, notebook/source organization | Best-in-class source-oriented interaction | Source sets, citation navigation, grounded answer presentation | Adopt source-set and citation interaction patterns |
| Cursor | Project/codebase context, rules, indexed workspace, agent workflow | Excellent coding workflow and context affordances | Repository-aware context packs and stale-index visibility | Adopt context-pack/status UI, not proprietary capture assumptions |
| GitHub Copilot Memory | Repository/PR/task continuity direction | Low-friction developer context | Commit/PR/issue evidence linking and freshness | Adopt evidence links and stale signals |
| Notion AI | Workspace knowledge, pages, permissions, search | Familiar knowledge workspace and sharing model | Human-editable project knowledge and permissions | Adopt review/edit ergonomics; preserve OARC’s stronger provenance model |

Useful primary references:

- [Mem0 platform and memory operations](https://docs.mem0.ai/)
- [Zep and Graphiti documentation](https://help.getzep.com/)
- [Letta documentation](https://docs.letta.com/)
- [LangGraph persistence and checkpoints](https://langchain-ai.github.io/langgraph/concepts/persistence/)
- [LlamaIndex evaluation and retrieval docs](https://docs.llamaindex.ai/)
- [Pinecone Assistant documentation](https://docs.pinecone.io/guides/assistant)
- [NotebookLM help](https://support.google.com/notebooklm/)
- [Cursor documentation](https://docs.cursor.com/)
- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [Notion AI documentation](https://www.notion.so/help/guides/ai)

## Major findings and high-impact upgrades

### 1. Live capture proof is the highest-risk gap

The code has Codex normalization and persistence contracts, but a tested normalization function is not proof that this chat is automatically captured. Add a visible capture status, event counters, last-seen message ID, queue depth, and a synthetic end-to-end probe. A user must be able to see `connected`, `receiving`, `queued`, `processed`, or `uncaptured`.

### 2. Identity must be more granular than tenant/bank

Add `user_id`, `agent_id`, `app_id`, and `run_id` to every memory and event. This enables safe multi-agent demos, exact run replay, scoped deletion, and meaningful A/B comparisons.

### 3. Retrieval needs a real query language

Implement a validated nested `AND`/`OR`/`NOT` filter DSL with allow-listed fields and operators. This is a larger usability upgrade than adding another retrieval arm because it gives operators control over scope, time, status, entity, network, category, and evidence quality.

### 4. Evaluation must measure usefulness, not only token overlap

Keep the deterministic judge for regression, but add exact-answer, citation-correctness, unsupported-claim, human-rating, latency, token, queue, and persistence metrics. Run the same golden conversations in four modes: no memory, local memory, live PostgreSQL memory, and memory plus project manifest.

### 5. Make revisions and conflicts first-class

Mem0-style update ergonomics and Letta-style editable memory are useful, but OARC should preserve append-only history. Add revision timelines, supersession edges, conflict review, immutable records, and operator-approved resolution. Never silently rewrite historical evidence.

### 6. Copy the best evidence-oriented UI patterns

The strongest common UI pattern is not a decorative dashboard. It is a compact operational surface showing scope, freshness, citations, confidence, source navigation, stale/conflict states, and a clear intervention path. Finish the audit route, evidence drawer, run inspector, and browser E2E.

## Recommended integration stack

Recommended, in order:

- **OpenTelemetry** for traces and metrics, with redaction at the instrumentation boundary.
- **Langfuse or Phoenix** for LLM traces, evaluations, prompt/version comparisons, and failure inspection. Choose one initially; do not wire both into the critical path.
- **n8n** for controlled inbound/outbound workflow experiments after webhook authentication and replay protection exist.
- **Graphiti/Zep concepts**, not necessarily the hosted service, for bounded temporal/entity projections.
- **Playwright** for browser acceptance and Codex-like workflow probes.
- **PostgreSQL** as the canonical store; defer Redis/Temporal/Kafka until measured queue/load evidence requires them.
- **Sentry** only for error aggregation after secret and conversation-content redaction is enforced.

Avoid adding a hosted memory provider as a second source of truth. OARC’s differentiator is provenance, governance, and explicit capture gaps.

## Implementation slices

### Slice A — Capture and runtime truth

Files:

- `lib/runtime/codex-ingestion.ts`
- `lib/runtime/project-memory-pipeline.ts`
- `lib/runtime/project-worker.ts`
- `lib/runtime/telemetry.ts`
- `app/api/mcp/route.ts`
- new `app/api/project-memory/status/route.ts`
- new `components/oarc-v2/capture-status.tsx`

Work:

1. Add a `CaptureStatus` contract with connection, last event, queue, processed, failed, and capture-gap fields.
2. Emit redacted telemetry for received, normalized, persisted, queued, extracted, governed, and failed states.
3. Add a signed/explicit synthetic probe that writes one test event and verifies replay and projection.
4. Add idempotency and correlation IDs to every stage.

Acceptance:

- one Codex/MCP event can be traced from ingress to governed record;
- duplicate delivery produces one canonical event and two observable delivery attempts;
- status distinguishes zero traffic from disconnected traffic;
- no raw secret or full private prompt is emitted to telemetry.

### Slice B — Scope and filter DSL

Files:

- `lib/runtime/contracts.ts`
- `lib/runtime/schemas.ts`
- new `lib/engine/filters.ts`
- `lib/runtime/repositories/interfaces.ts`
- `lib/runtime/repositories/postgres.ts`
- `lib/runtime/mcp/tools.ts`
- new `components/memory/filter-builder.tsx`

Core types:

```ts
export type MemoryIdentityScope = {
  userId?: string;
  agentId?: string;
  appId?: string;
  runId?: string;
};

export type MemoryFilter =
  | Record<string, unknown>
  | { AND: MemoryFilter[] }
  | { OR: MemoryFilter[] }
  | { NOT: MemoryFilter };

export type FilterOperator = 'eq' | 'ne' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'icontains';
```

Acceptance:

- filters are validated before SQL generation;
- unknown fields/operators fail closed;
- every query carries tenant, bank, project, and optional run scope;
- API, MCP, repository, and test-double behavior is equivalent.

### Slice C — Live evaluation lab

Files:

- `lib/runtime/tier1-benchmark.ts`
- existing `app/sandbox/eval/page.tsx`
- new `tests/runtime/live-benchmark.test.ts`
- new `docs/benchmarks/2026-10-08-codex-baseline.json`

Core result:

```ts
type BenchmarkCaseResult = {
  caseId: string;
  mode: 'without-memory' | 'local-memory' | 'postgres-memory' | 'manifest-memory';
  answerScore: number;
  citationPrecision: number;
  unsupportedClaimRate: number;
  latencyMs: number;
  retrievalLatencyMs: number;
  queueDelayMs: number;
  inputTokens?: number;
  outputTokens?: number;
  persisted: boolean;
  captureStatus: 'captured' | 'partial' | 'uncaptured';
};
```

Run protocol:

1. Freeze a golden project corpus and 20–40 representative prompts.
2. Randomize prompt order and alternate modes to reduce temporal bias.
3. Keep model, temperature, prompt template, timeout, and tool budget constant.
4. Record raw result hashes and redacted evidence IDs.
5. Report median, p95, accuracy, citation precision, unsupported claims, tokens, queue delay, and persistence rate.
6. Repeat after each major slice; never compare runs with changed corpus without labeling it.

### Slice D — Revision, conflict, and review workflow

Add revision history, immutable memory, batch updates, conflict queues, approval actions, and evidence-linked resolution. Build a review screen with “accept supersession,” “mark uncertain,” “invalidate evidence,” and “restore prior projection.” Every action creates an audit event.

### Slice E — Project manifest and run inspector

Expose current branch, runtime, active decisions, stale items, failed tests, queue state, capture gaps, and next actions in one source-linked manifest. Add a run inspector that shows events, retrieval trace, citations, worker jobs, and resulting records.

### Slice F — Operator-grade UI and browser QA

Complete the evidence drawer, capture status, filter builder, evaluation comparison, graph/route inspector, responsive layouts, keyboard access, reduced motion, and Playwright flows for retain → recall → citation → audit → benchmark export.

### Slice G — Optional scale adapters

Only after load evidence: OpenTelemetry collector, Langfuse/Phoenix exporter, n8n connector, Graphiti-style temporal projection, and queue infrastructure. Each adapter must remain optional and must not become the canonical memory source.

## Validation matrix

| Gate | Required evidence |
|---|---|
| Code | Typecheck, lint, unit tests, schema tests |
| Persistence | Migration, PostgreSQL integration, restart/recovery, dead-letter and replay |
| API/MCP | JSON-RPC initialize/list/call, scope isolation, idempotency, error envelopes |
| Browser | Playwright capture status, memory workflow, audit, benchmark export at 375/768/1440 widths |
| Performance | p50/p95 MCP latency, queue delay, extraction latency, retrieval latency, render cost |
| Quality | answer score, citation precision, unsupported claims, supersession correctness |
| Security | redaction, auth, tenant/project scope, secret scan, replay protection |
| Production | build/start smoke, health/readiness, migration rehearsal, restore drill |

## Benchmark to share before implementation

The current report is a **repository baseline**, not yet the requested live-chat benchmark:

- 100% pass rate on the existing local scenario fixture;
- 92.9% deterministic token-overlap accuracy;
- no measured accuracy improvement in that fixture between its “before” and “after” configurations;
- 92% Mem0 and 81% Zep figures are reference values, not locally reproduced;
- no verified end-to-end capture measurement for this Codex chat;
- no browser/plugin E2E proof for the audit surface.

Before implementation, the first controlled run should be recorded with the Slice C schema and explicitly labeled `baseline`. After implementation, rerun the same corpus and publish absolute values and deltas, not a marketing score.

## Major risks and counterarguments

- More memory can increase stale or contradictory context; every retrieval result needs freshness and provenance.
- A filter DSL can become a security boundary; validate and scope it server-side, not only in the UI.
- Hosted observability tools can leak private conversations; default to metadata and hashes, with opt-in redacted snippets.
- A graph database may add operational cost without improving current workloads; keep bounded relational projections first.
- LLM judges can reward plausible but unsupported answers; retain deterministic checks and human spot audits.
- Capturing every chat can create privacy and retention obligations; expose capture status and configurable retention.

## Definition of done for the upgrade

The upgrade is effective only if the same benchmark corpus demonstrates a statistically and operationally meaningful improvement in at least three dimensions: grounded answer quality, citation precision, capture completeness, or operator time-to-diagnosis, without exceeding the agreed MCP/chat latency budget or introducing scope/security regressions.
