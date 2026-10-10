# Apex Tier-1 Evidence-Driven Agent Memory Control Plane Blueprint

Date: 2026-10-10
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`
Status: Canonical execution blueprint

## Strategic outcome

Ray Sandbox OARC becomes an **Evidence-Driven Agent Memory Control Plane**: the enterprise system that determines what an agent may remember, why context was recalled, whether it remains true, and how it can be corrected safely.

The competitive moat combines a traceable time-aware evidence graph with a closed-loop memory-quality flywheel:

```text
durable source evidence
→ governed memories and temporal relationships
→ scoped, policy-aware retrieval
→ explanation and outcome trace
→ failure classification and correction
→ replayable measured improvement
```

Leadership is measured by trust, control, and learning—not feature count or a local demo.

## Non-negotiable architecture

- PostgreSQL is the canonical durable memory, evidence, graph, audit, and evaluation store.
- No hosted provider, vector store, graph database, connector, or telemetry service becomes a second source of truth.
- Every derived memory and graph relationship links to immutable source evidence.
- Every mutation has a durable ledger event, correlation ID, and idempotency boundary.
- Scope is preserved and enforced for tenant, bank, project, conversation, user, agent, app, and run where applicable.
- Historical evidence is append-only; corrections use revisions, supersession, invalidation, restoration, and auditable deletion workflows.
- Provider extraction produces proposals only. The governed pipeline controls persistence.
- External deployment, provider credentials, external rollback/RPO/RTO evidence, and live non-Codex connectors are frozen until explicitly authorized.

## Control-plane contracts

The platform evolves through these durable records:

| Record | Purpose | Mandatory fields |
|---|---|---|
| Episode/event | Raw conversation, tool, connector, or workflow unit | scope, correlation ID, timestamp, source identity, redaction state |
| Evidence | Immutable support for a claim | source reference, content hash, observed time, access policy |
| Memory | Governed derived assertion | evidence IDs, confidence, lifecycle state, policy decision, timestamps |
| Entity | Resolved durable subject | canonical name, aliases, resolution confidence, scope |
| Relationship | Typed temporal graph edge | subject, predicate, object, evidence IDs, validity, state |
| Revision | Correction, conflict, restoration, or invalidation | target, reviewer/policy decision, reason, trace ID |
| Retrieval trace | Why candidates were included or excluded | query scope, scores, rationale, policy result, graph path |
| Evaluation run | Reproducible quality and cost result | corpus/config version, result hashes, latency, tokens, outcome |

The first graph strategy is a bounded relational projection in PostgreSQL. Traversal must enforce scope and temporal filters, maximum depth, cycle protection, source-evidence completeness, and explanation of each selected hop. A graph database requires later measured proof that PostgreSQL cannot meet the required workload.

## Governed extraction and review

```text
evidence
→ deterministic or provider extraction proposal
→ schema validation
→ entity resolution and temporal/conflict analysis
→ policy decision
→ review queue when required
→ governed memory and graph projection
→ event ledger and retrieval trace
```

Deterministic extraction remains a safe `degraded` fallback. Provider-backed extraction must report schema rejection, extraction precision, latency, token use, cost, confidence, and source evidence. Invalid or unapproved proposals must never become canonical memory.

Policies are versioned, auditable, testable, and exportable at bank, project, user, agent, memory-type, connector, privacy, retention, model/cost, approval, and explainability levels. Policy outcomes are `allow`, `deny`, `redact`, `require_review`, or `defer`.

Human review is required for low-confidence, contradictory, sensitive, superseding, or policy-flagged entries. Review actions are reversible and evented.

## Closed-loop memory-quality flywheel

```text
retrieval or downstream failure
→ durable trace and evidence preservation
→ root-cause classification
→ correction proposal and policy/review decision
→ replay original workflow
→ compare before and after
→ promote a verified improvement to regression coverage
```

The failure taxonomy includes missing evidence, wrong scope, stale fact, temporal interpretation, entity resolution, missing graph hop, contradiction, unsupported claim, extraction failure, policy rejection, and connector delivery/replay failure.

No improvement claim is accepted until the replay improves the original case without creating provenance, isolation, latency, or grounding regressions.

## Execution slices

### Slice 1 — Enterprise Evidence Integrity Baseline

Complete exhaustive provenance and event-ledger audits, a meaningful sustained SLO workload, explicit dead-letter replay-to-complete proof, and authenticated browser journeys for review, events, manifest, export, and 768px accessibility.

Exit criteria:

- 100% derived-memory provenance coverage.
- 100% mutation-to-ledger coverage.
- Zero automated cross-tenant results.
- Duplicate-safe delivery and durable replay proof.
- Retain p95 below 250 ms and recall p95 below 500 ms, excluding external-model execution.
- Worker completion measured over a meaningful workload, not inferred from a small sample.

### Slice 2 — Typed Temporal Evidence Graph

Add entities, aliases, typed relationships, temporal validity, deterministic entity resolution, conflict states, and evidence-backed one/two-hop traversal. Support “as of,” “before upgrade,” supersession, and contradiction queries.

### Slice 3 — Provider Extraction and Human Approval

Add provider-neutral extraction proposals, strict validation, redacted telemetry, budgets, timeouts, confidence thresholds, policy routing, and approval queues. Measure provider quality against adversarial and human-reviewed cases.

### Slice 4 — Closed-Loop Evaluation and Replay

Expand the versioned adversarial corpus beyond deterministic replay into durable evaluations that measure grounded accuracy, citations, unsupported claims, graph accuracy, latency, tokens, queue delay, and cost per correct answer.

### Slice 5 — Developer API and Operator Experience

Deliver a low-friction developer workflow:

```text
retain → recall → trace → correct → replay → evaluate
```

Keep it separate from the operator workspace:

```text
health → evidence → graph → conflicts → policies → events → benchmarks → exports
```

Complete the guided flow: Connect agent → import source → retain → recall → inspect evidence. Every major route must cover empty, queued, healthy, degraded, unavailable, failed, and unauthorized states; keyboard navigation; visible focus; reduced motion; 375/768/1440 responsive layouts; and serious/critical axe checks.

### Slice 6 — Connector and Runtime Ecosystem

Priority order is Codex/MCP live capture, one high-value developer-system connector, one enterprise collaboration connector, then additional runtime connectors by measured demand. Each connector requires authenticated ingestion, source cursor/checkpointing, idempotency, retry/dead-letter replay, provenance, deletion propagation, redaction, and connector-specific health evidence.

## Quality and release gates

| Evidence label | Required proof |
|---|---|
| `IMPLEMENTED` | Contract or source exists |
| `TESTED` | Focused automated tests pass |
| `LOCALLY VERIFIED` | Local runtime/database/Docker flow passed |
| `BROWSER VERIFIED` | Authenticated browser flow passed |
| `BENCHMARK VERIFIED` | Versioned corpus/workload report exists |
| `LIVE CONNECTOR VERIFIED` | Authorized source delivery is durable and traceable |
| `PRODUCTION VERIFIED` | Authorized external environment was exercised |

Every slice must provide the appropriate code, database, API/MCP, browser, benchmark, security, and documentation evidence. A build, HTTP `200`, local container, fixture, or mocked connector cannot substitute for a higher evidence label.

## Current foundation and boundaries

The project already has local PostgreSQL memory paths, lifecycle ingestion contracts, Memory Trace/evidence graph foundations, event-ledger and provenance contracts, local SLO/audit scripts, dead-letter primitives, deterministic adversarial evaluation, authenticated browser coverage, policy foundations, and production-like local Docker validation.

The active next boundary is **Slice 1 — Enterprise Evidence Integrity Baseline**. External deployment and provider authorization remain frozen, not silently inferred from local validation.

## Definition of leadership

OARC earns its category only when the same versioned corpus and workload prove:

- evidence-complete, time-correct, scope-safe retrieval;
- explainable multi-hop graph answers;
- safe correction and deterministic replay;
- stronger grounded quality and citation correctness;
- lower operator time-to-diagnosis;
- transparent latency, token use, and cost per correct answer;
- no regression in privacy, provenance, or authorization.
