# Ray Sandbox OARC Feature and Market Audit

Date: 2026-10-23  
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`  
Scope: Memory, Prompt Studio, Context Tuning, Continuous Learning, Orchestrator, Evaluation

## Executive finding

Ray Sandbox OARC has a promising control-plane design and unusually strong evidence, provenance, temporal-memory, and failure-state contracts for an early product. It is not yet an integrated production competitor. The six named surfaces currently mix two different products:

1. A deterministic browser sandbox backed mainly by Zustand/localStorage and fixture data.
2. A partially implemented server-backed workflow under `/api/v1/memory/*`, PostgreSQL repository contracts, and `/sandbox/developer`.

The UI itself states this boundary: the Settings page describes the app as a deterministic browser simulation with no backend or LLM calls, and the Developer page says canonical-store and browser verification are separate gates. That honesty is correct, but it means the current product should be rated `PARTIAL`, not `production-ready` or `100% efficient`.

The highest-value strategy is to make one durable loop the product spine:

`source → retain → recall → evidence trace → correction → replay → evaluation → promoted regression`

Every other feature should operate on the same scoped records, workflow run, trace, event, and evaluation IDs.

## Evidence collected

### Direct repository and runtime evidence

- `IMPLEMENTED`: routes exist for all six requested surfaces: `/sandbox/memory`, `/sandbox/prompts`, `/sandbox/context`, `/sandbox/learning`, `/sandbox/orchestrator`, and `/sandbox/eval`.
- `IMPLEMENTED`: the canonical blueprint defines PostgreSQL, immutable evidence, scoped retrieval, event-ledger mutation, temporal graph, replay, and evaluation requirements.
- `IMPLEMENTED`: repository, API, workflow, evaluation, replay, trace, policy, audit, benchmark, and operator modules exist.
- `TESTED`: focused runtime gate: 7 files, 40 tests passed.
- `TESTED`: full Vitest: 105 files passed, 2 skipped; 344 tests passed, 6 skipped.
- `TESTED`: TypeScript typecheck passed.
- `HTTP verified`: `127.0.0.1:3000` returned the Ray Sandbox OARC title and HTTP 200 for all six feature routes, `/sandbox`, `/sandbox/developer`, `/api/v1/health`, and `/api/v1/ready`.
- `LOCALLY VERIFIED`: health returned `canonicalStore: healthy`; readiness returned `ready`.
- `HTTP verified`: the unauthenticated workflow read returned HTTP 401 with `state: unauthorized`, which is the expected fail-closed boundary.
- `BROWSER VERIFIED`: the correct in-app browser opened all six feature routes and the Developer workbench. Navigation and route identity worked.
- `BROWSER VERIFIED`: the shared shell displayed the correct Ray Sandbox OARC identity, scope selector, feature navigation, and explicit Developer workflow steps.
- `BROWSER VERIFIED`: the Developer page visibly labelled the workbench as local and reported that browser/canonical-store verification are separate gates.
- `NOT BROWSER VERIFIED`: the complete authenticated durable workflow was not proven.
- `NOT BENCHMARK VERIFIED`: no same-corpus, same-model, same-cost competitor comparison was executed.
- `NOT PRODUCTION VERIFIED`: no external deployment or live connector was authorized or exercised.

### Browser-suite limitation

`npm run test:e2e` ran 36 tests and all 36 failed before meaningful assertions because the Playwright configuration targeted unavailable services at `127.0.0.1:3028` and `127.0.0.1:3030`. Examples include `ERR_CONNECTION_REFUSED` for sandbox pages and `ECONNREFUSED` for API requests. This is a release-blocking test-target problem, not a valid feature pass or a valid feature-quality score. The suite must be repointed to the intended app or the required staging targets must be started before browser acceptance can be assessed.

## Feature audit

Maturity scores below are heuristic engineering scores, not market-share or benchmark claims. They reflect surface breadth, daily-use completeness, durability, security, observability, and direct evidence.

| Feature | What exists | Daily-use result today | Material gap | Maturity |
|---|---|---|---|---:|
| Memory | Retain/recall/reflect, four networks, entities, graph links, filters, session buffer, image attachment simulation, trace UI, health states | Good deterministic exploration and teaching experience; not one durable source of truth from the main Memory page | Main Memory page is local/browser-first; no proved authenticated retain→recall→correct journey; localStorage is explicitly described | 2.8/5 |
| Prompt Studio | Templates, editor, version history, A/B compare, bank/disposition controls, test run | Useful for local prompt iteration and comparison | No durable prompt registry/labels, production promotion, trace-linked prompt metrics, approval policy, or CI regression gate | 2.5/5 |
| Context Tuning | Retrieval depth, token ceiling, reranking, chunks, filters, consolidation and steering controls | Strong conceptual tuning surface; useful for explaining retrieval trade-offs | Several behaviors are simulated; no measured quality/latency/cost trade-off on a versioned corpus; settings are not consistently attached to durable runs | 2.6/5 |
| Continuous Learning | Episodes, bank entries, ledger rows, judge averages, CRUD memory bank, Ledger-QA, learning curves, UMA-inspired flow | Good demo of learning concepts and memory-bank operations | No proven ingestion from live traces, admission policy loop, human approval, promoted skill/regression artifact, or durable outcome feedback loop | 2.1/5 |
| Orchestrator | Visual nodes for Memory App, Prompt Studio, Context Tuner, Continuous Learner, LLM Router, Data Source, Evaluator, Webhook Sink; wire mode and inspector | Good product concept and architecture visualization | No proved executable graph runtime, durable node state, retries, compensation, authorization, versioned graph releases, or end-to-end trace correlation | 2.0/5 |
| Evaluation | Evaluation contracts, metrics, failure taxonomy, replay/comparison concepts, local evaluation UI, benchmark reports | Strong foundation for offline deterministic evaluation | Browser workflow, transaction boundary, online scoring, dataset/version registry, human annotation, CI gate, and same-corpus market proof remain incomplete | 2.7/5 |

### What is strongest

The strongest differentiator is not the number of screens. It is the intended governed loop: evidence-backed memory, temporal scope, trace rationale, corrections, replay, and durable event history. That is a credible enterprise moat if it is made real and measured.

### What is weakest

The weakest point is product integration. The navigation presents six apps, but they do not yet share one fully proven durable contract. A user can explore them as a sandbox, while the production-like workflow remains a separate and partially verified path. This creates the most dangerous failure mode for a daily tool: a user believes a local success is canonical, durable, and reusable when it is not.

## Competitor comparison

This comparison uses current official product documentation, not third-party rankings.

| Capability | Ray Sandbox OARC today | Strong market reference | Where the competitor is ahead | Ray opportunity |
|---|---|---|---|---|
| Agent memory | Four-network deterministic memory, temporal/evidence design, local graph and trace concepts; durable API contracts are partial | [Mem0 Platform](https://docs.mem0.ai/platform/overview) | Managed memory, scoped user/agent/app/run model, managed infrastructure, audit/governance, webhooks and multimodal support | Win on inspectable provenance, temporal correction, policy decisions, and replay—after the durable path is proven |
| Temporal context | Blueprint and typed-graph contracts; local graph projections | [Zep documentation](https://help.getzep.com/) | Temporal Context Graphs, Context Lake, ingestion/status APIs, source traceability, governance, audit logging, agent skills and learning controls | Win by combining temporal graph + immutable evidence + correction/replay in one control plane |
| Prompt engineering | Local editor, history, A/B compare, test run | [Langfuse Prompt Management](https://langfuse.com/docs/prompt-management/overview) | Central versioned prompts, labels/environments, trace linkage, cached retrieval, playground and deployment decoupled from code | Make every prompt version a durable, scoped artifact linked to context config, trace, eval, approval, and release decision |
| Orchestration | Visual node canvas and inspector concept | [LangGraph](https://docs.langchain.com/oss/python/langgraph/overview) and [LangSmith Studio](https://docs.langchain.com/langsmith/studio) | Durable execution, persistence, streaming, human-in-the-loop, graph debugging, experiments, long-term memory, and deployment workflow | Make the canvas executable, resumable, policy-aware, and evidence-linked; keep visual design subordinate to runtime truth |
| Evaluation | Local contract/metrics/replay foundation and benchmark fixtures | [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation) and [Langfuse Evaluation](https://langfuse.com/docs/evaluation/overview) | Datasets, human/code/LLM judges, offline+online evaluation, production trace sampling, annotation, side-by-side experiments, CI/regression gates | Win on groundedness, citation correctness, provenance, scope isolation, temporal correctness, replay safety, and cost per correct answer |
| Continuous improvement | UMA-inspired learning surface and local learning curves | Zep learning/skills surfaces plus LangSmith/Langfuse feedback loops | Real trace feedback becomes datasets, skills, evaluators, or controlled releases | Build an explicit admission→review→replay→regression-promotion pipeline; never silently self-modify canonical memory |

The market lesson is clear: competitors already package the operational loop around their primitives. Ray should not compete by adding more isolated screens. It should compete by making evidence, scope, temporal truth, correction, and reproducible improvement stronger and easier to verify than general-purpose platforms.

## Daily-scenario test matrix

| Scenario | Expected Tier-1 behavior | Current evidence | Decision |
|---|---|---|---|
| Developer records a decision and recalls it next day | Durable retain, scoped recall, citations, trace, request/workflow IDs | Local Memory UI can simulate this; server APIs/contracts exist; authenticated browser journey not proven | Blocked for release |
| Team changes a prompt and compares it before release | Versioned prompt, same dataset, score diff, approval and rollback | Local editor/A-B surface exists; no durable release gate | Partial |
| User asks a multi-hop question under a token budget | Scope/temporal filters, graph hops, cited evidence, latency/tokens | Retrieval and graph contracts/tests exist; no complete browser+workload proof | Partial |
| A bad memory is corrected | Revision, immutable history, event/outbox, no silent overwrite | Correction transaction path exists; latest full rollback/duplicate/browser evidence incomplete | Partial |
| A failed run is retried | Idempotency, retryable state, dead-letter/replay, same workflow correlation | Runtime primitives/tests exist; browser failure/recovery journey not proven | Partial |
| Production trace reveals a failure | Trace becomes a dataset case, evaluator scores it, fix replays, regression is promoted | Evaluation/failure taxonomy exists; online ingestion and promotion loop not proven | Missing |
| Operator investigates degraded storage | Explicit unavailable/degraded state, request ID, recovery action, no fake zeros | UI and route-state contracts exist; staging/browser target unavailable | Partial |
| New user connects an agent | Scoped auth, safe onboarding, first retain/recall, evidence inspection | Onboarding and Developer pages exist; authenticated end-to-end proof unavailable | Partial |

## Tier-1 improvement plan

### Phase 0 — Correct target and evidence harness

1. Make one canonical local target explicit in Playwright configuration; fail fast if the target is not Ray Sandbox OARC.
2. Start the required local PostgreSQL/staging process or make the suite run against the intended `:3000` development app with a test-safe repository.
3. Add a preflight that asserts repository identity, page title, health, readiness, asset load, and API base URL.
4. Record test evidence by label; never convert connection-refused into a feature result.

Exit gate: the 36 browser tests reach application assertions at 375, 768, and 1440 widths.

### Phase 1 — One canonical contract across all six surfaces

Create shared durable types for `Project`, `WorkflowRun`, `Source`, `Memory`, `PromptVersion`, `ContextConfig`, `GraphRun`, `EvaluationRun`, `Trace`, `Revision`, `Event`, and `Outbox`. Every object must carry tenant, bank, project, correlation, request, and idempotency context where applicable.

The UI should consume server results through one envelope:

```ts
{
  ok,
  requestId,
  workflowRunId,
  state,
  data,
  trace,
  error?,
  retryable?
}
```

Exit gate: no primary feature action silently falls back from canonical failure to local success.

### Phase 2 — Finish the golden path first

1. Complete atomic evaluation persistence: run, event, outbox, and workflow update in one transaction.
2. Complete atomic replay persistence with workflow update inside the bundle transaction.
3. Finish envelope adoption on retain, recall, trace, correct, replay, evaluate, and workflow routes.
4. Make refresh/resume restore server workflow state and all evidence metadata.
5. Add duplicate, rollback, unauthorized, stale, missing, unavailable, degraded, and retryable tests.

Exit gate: one authenticated browser run can complete `retain → recall → trace → correct → replay → evaluate`, refresh, and recover the same server-backed state.

### Phase 3 — Turn each feature into a real part of that loop

- Memory: canonical retain/recall/correct APIs behind the main Memory UI; evidence drawer shows source, confidence, freshness, policy, exclusions, graph hops, and revision history.
- Prompt Studio: durable prompt registry, semantic versions, labels (`draft`, `staging`, `production`), variables/schema validation, trace linkage, approvals, rollback, and experiment launch.
- Context Tuning: versioned retrieval policy with depth, token budget, reranker, chunking, graph-hop cap, temporal policy, and scope policy; every output records the config hash.
- Continuous Learning: failure-to-case ingestion, admission policy, human review, replay, before/after comparison, regression promotion, and rollback. Learning must produce proposals, not uncontrolled writes.
- Orchestrator: executable graph runtime with durable node state, pause/resume, retries, timeouts, compensation, human gates, scoped tool permissions, and trace/event correlation. The canvas is an editor for this runtime, not a separate simulator.
- Evaluation: dataset/version registry, deterministic/code/LLM/human evaluators, online sampling, annotation queues, pairwise comparison, cost/latency/token reporting, and CI release gates.

### Phase 4 — Prove effectiveness in real scenarios

Build a versioned, redacted corpus with at least these case families: stale fact, contradiction, cross-tenant leakage attempt, entity alias, temporal “as of” query, unsupported claim, missing graph hop, prompt regression, empty retrieval, provider timeout, retry duplicate, correction, and replay.

Measure the same release against the same corpus and workload:

- grounded answer rate;
- citation precision and evidence completeness;
- temporal correctness;
- scope isolation failures, target zero;
- correction/replay correctness;
- p50/p95 latency by operation;
- queue delay and retry rate;
- tokens and cost per correct answer;
- operator time to diagnose;
- regression rate across prompt/context/orchestrator versions.

Do not claim “beats competitors by a huge margin” until the same harness, corpus, model class, context budget, and cost accounting have been run against comparable implementations. The defensible near-term claim is narrower: “Ray provides stronger evidence and correction control for the scenarios it proves.”

## Recommended release gates

The six features should not be marketed as one integrated platform until all of these are true:

- `TESTED`: full runtime suite remains green and skips are explained.
- `LOCALLY VERIFIED`: PostgreSQL migration, repository, worker, and rollback paths pass.
- `BROWSER VERIFIED`: authenticated workflow passes at 375/768/1440, keyboard, reduced motion, and axe serious/critical checks.
- `BENCHMARK VERIFIED`: versioned corpus and workload report shows quality, latency, cost, and no scope/provenance regressions.
- `LIVE CONNECTOR VERIFIED`: only after an authorized connector delivers durable traceable evidence.
- `PRODUCTION VERIFIED`: only after the authorized external deployment is exercised.

## Bottom line

The app has a strong architectural direction and a credible evidence-first differentiator, but its current market position is “advanced deterministic sandbox plus partial durable control-plane implementation,” not a proven unified competitor. The first Tier-1 investment should be integration and evidence: correct the browser target, finish the durable golden path, connect all six surfaces to the same contracts, and measure real scenarios. This is the shortest path to a product that can make a defensible superiority claim.
