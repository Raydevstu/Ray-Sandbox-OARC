# Apex Memory Platform Architecture

**Status:** Design approved in conversation; written-spec review pending  
**Date:** 2026-10-06  
**Target:** Hindsight Sandbox / `hindsight-memory-slice`

## 1. Purpose and scope

This specification defines the transformation of Hindsight Sandbox from a deterministic, browser-first memory study environment into a dual-plane agent-memory platform:

1. A deterministic reference and simulation plane that preserves the existing local experience, reproducible evaluation, and browser-safe demonstrations.
2. A production runtime plane that adds durable canonical storage, tenant-scoped APIs, lexical and dense retrieval, graph projections, event processing, integrations, observability, and bounded recovery.

The two planes share domain contracts, event envelopes, retrieval intent, provenance, evaluation fixtures, and trace semantics. They differ in execution providers and operational guarantees.

This specification covers retention, hybrid retrieval, graph memory, layered context, integrations, UI/runtime synchronization, self-healing, security, testing, asset integration, and delivery sequencing. It does not select a cloud vendor, embedding vendor, reranker vendor, or dedicated graph database prematurely.

## 2. Design principles

- Canonical memory is authoritative; indexes, graphs, layers, caches, and integration payloads are derived.
- Every accepted memory claim has evidence and provenance.
- Memory is immutable by revision; consolidation creates new versions rather than silent overwrites.
- Current, historical, and all-evidence retrieval are explicit policies.
- Tenant and bank scope are enforced at API, application-service, repository, and worker boundaries.
- All state-changing operations are idempotent and evented.
- Derived projections are rebuildable from canonical state and event history.
- Simulation and live runtime modes are explicit and never silently interchangeable.
- Self-healing is bounded, auditable recovery, not autonomous destructive mutation.
- External benchmark figures remain source-reported unless reproduced locally.
- The first production slice is lexical and durable; dense, graph, reranking, and repair capabilities are staged behind ports.

## 3. Current system baseline

The current sandbox contains deterministic implementations or reference behavior for:

- retention and consolidation;
- entity extraction;
- temporal metadata;
- recall and retrieval tracing;
- layered summaries and token packing;
- cited digests and abstention;
- evaluation and benchmarks;
- MCP examples;
- feedback and offline queues;
- filesystem projections;
- snapshots and observability.

The current application is not yet a production memory service. It does not, by itself, prove durable multi-user persistence, high-volume vector retrieval, transactional event processing, graph storage, tenant authorization, operational SLOs, or deployment readiness.

## 4. Dual-plane architecture

```text
Agent / UI / MCP / SDK
          |
Versioned API and authorization boundary
          |
Retention | Recall | Reflection services
          |
Canonical relational memory and evidence store
          |
Transactional outbox and durable job consumers
       /       |        |        \
 lexical   vector    graph     layers
 index     index   projection  projection
```

The deterministic plane implements these boundaries locally with pure engines and Zustand. The runtime plane implements them with durable repositories and replaceable providers. Neither plane may expose provider-specific semantics as the canonical domain model.

## 5. Canonical domain model

The canonical model consists of `Tenant`, `MemoryBank`, `Principal`, `MemoryFact`, `Evidence`, `Entity`, `SemanticEdge`, `MemoryLayer`, `EventRecord`, `OutboxRecord`, `FeedbackRecord`, `Snapshot`, and `RetrievalTrace`.

Every tenant-scoped record contains `tenantId`; every bank-scoped record contains both `tenantId` and `bankId`. Every memory fact contains a stable ID, revision, kind, subject/predicate/object or text representation, lifecycle state, confidence, temporal metadata, entity references, evidence references, supersession references, source, and timestamps.

Evidence is immutable. Source changes produce new evidence and a new memory revision. Event time and mention time remain separate from observation and ingestion time.

Temporal metadata supports `event`, `state`, `plan`, `preference`, and `procedure` memory types, with optional valid ranges, event time, mention time, current/historical/planned/unknown status, and precision.

## 6. Retention contract and flow

Retention accepts a tenant-scoped source, content, timestamps, metadata, actor, and idempotency key. Boundary validation rejects empty content, invalid scope, invalid timestamps, unsupported source types, oversized input, and incompatible reuse of an idempotency key.

The flow is:

```text
raw input
  -> validate envelope
  -> normalize and segment
  -> extract facts/events
  -> resolve entities
  -> assign temporal metadata
  -> attach evidence
  -> compare duplicate/contradiction/supersession state
  -> accept, reject, or review
  -> commit immutable revision
  -> emit MemoryRetained
```

In consolidating mode, new observations may create a refined version or observation. In additive mode, old and new claims coexist and a `supersedes` relationship is created where appropriate. No extraction failure may create a partial canonical record.

## 7. Retrieval contract and flow

Recall accepts tenant, bank, actor, query text, retrieval policy, top-K, token budget, filters, trace level, and request ID. Policies include `current`, `historical`, `all-evidence`, `decisions`, `procedures`, `preferences`, and `episodic`.

The retrieval pipeline is:

1. Normalize query and classify intent.
2. Authorize and scope before ranking.
3. Generate lexical, dense, entity, temporal, graph, and explicit-ID candidates.
4. Fuse candidates with reciprocal-rank fusion and policy-aware weights.
5. Apply temporal and supersession rules.
6. Rerank when configured, without making reranking mandatory.
7. Select L0/L1/L2 layers.
8. Pack within a hard token budget.
9. Generate a cited digest or context.
10. Return confidence, abstention state, citations, degraded status, and bounded trace.

`current` queries prefer active non-superseded facts; `historical` queries retain superseded evidence; `all-evidence` returns explicit lineage. Unauthorized candidates must not influence ranking.

Provider interfaces are required for lexical retrieval, dense retrieval, graph expansion, and reranking. The browser implementation may use deterministic substitutes. The runtime must support lexical-only degraded operation.

## 8. Graph memory

Graph state is a derived projection of canonical facts and events. It consists of scoped entity nodes and versioned semantic edges such as `mentions`, `supports`, `contradicts`, `supersedes`, `depends-on`, `causes`, `part-of`, and `related-to`.

Entity resolution uses stable identifiers first, scoped aliases second, normalized name/type third, contextual similarity fourth, and review for ambiguous merges. Display-name equality is insufficient for a global merge.

Graph expansion is bounded by hop count, node count, edge count, confidence threshold, relation allowlist, and tenant/bank scope. Relational nodes and edges are the initial implementation; a dedicated graph store requires measured justification.

Graph projections must be rebuildable from canonical state and events.

## 9. Layered context

Each fact may have:

- **L0:** compact abstract or identity representation;
- **L1:** subject, relationship, state, time, confidence, and entities;
- **L2:** source-backed detail, excerpts, lineage, contradictions, and references.

Layer records include source fact IDs, source revision, token count, checksum, generation timestamp, and status. Layer generation is asynchronous and versioned. Failed generation retains the last valid layer and marks the new layer unavailable.

Packing must never exceed the configured token budget, must preserve citations, must avoid duplicate representations, and must record excluded candidates and reasons in the trace.

## 10. Events, outbox, and jobs

State-changing operations write an immutable versioned event and an outbox record in the same transaction. Events contain event ID, schema version, tenant/bank scope, actor, correlation and causation IDs, idempotency key, timestamp, provenance, and payload.

Consumers include lexical indexing, embedding, graph projection, layer generation, evaluation metrics, cache invalidation, and observability. Consumers are idempotent, checkpointed, retryable, and dead-letter aware.

The first runtime slice may use a database-backed job mechanism. A separate queue platform is deferred until workload evidence requires it.

## 11. Integration surfaces

Versioned REST routes provide retain, recall, memory lookup/listing, feedback, snapshots, replay, events, jobs, health, readiness, and metrics. Responses use a consistent envelope with `ok`, `requestId`, data or safe error details, retryability, and pagination metadata.

MCP tools expose narrowly scoped memory operations and enforce the same authorization as REST. The SDK is contract-tested against the API. n8n, Zapier, Codex, Claude Code, OpenClaw, and Hermes integrations use canonical event payloads and explicit simulated/live delivery states.

No adapter may claim an external receipt when it only generated a payload.

## 12. Authorization and configuration

Production requires signed identity or scoped service credentials. Local development principals are available only when explicitly enabled. Permissions include `memory:read`, `memory:write`, `memory:feedback`, `memory:snapshot`, `memory:replay`, `memory:admin`, `operations:read`, and `operations:repair`.

Authorization is enforced in middleware, application services, repositories, and workers. Cursor tokens and cache keys include scope.

Configuration is schema-validated at startup and separates runtime settings, storage settings, provider choices, integration flags, and secrets. Secrets never appear in logs, traces, adapter examples, or exported snapshots.

## 13. Self-healing and degraded operation

Health is component-specific: canonical store, lexical index, vector index, graph projection, event consumer, layer generator, and integration gateway each report independent status.

Allowed automatic actions include transient retry, checkpoint resume, derived-index rebuild, projection replay, layer recomputation, cache invalidation, lexical fallback, and read-only degraded mode. Canonical deletion, semantic merging, tenant changes, snapshot restore, or destructive repair require operator authorization.

Recovery flow:

```text
health drift
  -> classify transient/persistent
  -> emit RepairRequested
  -> execute bounded idempotent repair
  -> validate projection
  -> emit RepairCompleted or RepairFailed
  -> update health and audit trail
```

## 14. Testing and readiness

The test program includes engine/unit tests, repository and event integration tests, API contract tests, browser E2E, MCP equivalence tests, evaluation fixtures, load tests, security tests, and snapshot restore drills.

Required evaluation dimensions include retrieval precision/recall, temporal accuracy, current/history accuracy, citation coverage/correctness, abstention precision, token efficiency, latency by stage, projection freshness, and replay correctness.

Production readiness requires verified authentication, tenant isolation, durable restart behavior, idempotent outbox replay, visible dead letters, rebuildable indexes, tested restore, explicit degraded behavior, bounded traces, rate limits, secret hygiene, rollback support, and runtime HTTP/browser evidence.

Initial target SLOs are provisional and must be validated under load: health under 100 ms locally, lexical recall under 250 ms p95, hybrid recall without an external reranker under 500 ms p95, asynchronous retain acknowledgement under 500 ms, and normal projection lag under 60 seconds.

## 15. Asset integration map

The supplied assets are mapped as follows:

- Hindsight configuration and retrieval captures inform retain/recall behavior and configuration boundaries.
- OpenViking filesystem, layered retrieval, session, and agent materials inform filesystem projections and layered context.
- Mem0 graph, entity, tagging, integration, and evaluation material informs entity resolution, semantic edges, metadata filters, adapters, and metrics.
- `autocapture.ts` informs capture normalization and retention adapters.
- `storage.ts` informs storage/runtime migration analysis.
- `recall-how-hindsight-retrieves-memories.md` informs retrieval stages and trace requirements.
- DevTools captures inform existing UI wiring and browser regressions.
- n8n and Zapier references inform adapter fixtures and delivery state.
- Claude Code, Codex, OpenClaw, and Hermes integration references inform agent profiles and local/offline boundaries.
- Existing engine modules in `hindsight-memory-slice/lib/engine` remain the deterministic contract reference.

Each asset must be labeled in the final research report as normative input, comparative reference, existing implementation, verification evidence, or background material.

## 16. Delivery sequence

1. Freeze contracts, event envelope, provenance, scope, traces, and migrations.
2. Build the canonical repository, authorization boundary, retain service, outbox, snapshots, and health.
3. Build lexical recall with current/history policies, layers, packing, and traces.
4. Add consumer checkpoints, retries, dead letters, and projection rebuilds.
5. Add dense retrieval behind an embedding/provider adapter.
6. Add relational graph projection and bounded traversal.
7. Add REST, MCP, SDK, webhook, n8n, Zapier, and agent profiles.
8. Connect the UI through explicit local/runtime modes.
9. Add bounded self-healing and operator repair workflows.
10. Run security, load, restore, browser, MCP, and deployment verification.

Every milestone must preserve the deterministic sandbox and leave a concrete verification report.

## 17. Non-goals

- Replacing the current sandbox with a cloud-only product.
- Treating simulated adapters as live integrations.
- Introducing an LLM or network dependency into the deterministic reference plane.
- Choosing a dedicated graph or vector vendor before workload evidence.
- Autonomous destructive memory repair.
- Claiming production readiness from successful builds alone.

## 18. Open decisions for implementation planning

The implementation plan must resolve, with explicit evidence:

- PostgreSQL deployment target and migration tooling;
- first vector provider and embedding model;
- identity provider or JWT issuer;
- job execution mechanism beyond the initial database-backed queue;
- API hosting topology;
- snapshot/object-storage target;
- exact SLO workload and dataset;
- whether the first runtime slice belongs inside the current Next.js application or a separate service package.

These are implementation selections, not reasons to weaken the canonical contracts.
