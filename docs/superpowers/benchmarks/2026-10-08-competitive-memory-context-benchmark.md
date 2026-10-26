# Competitive Memory and Context Benchmark

Date: 2026-10-08  
Product under review: Ray Sandbox OARC / hindsight-memory-slice  
Benchmark type: capability and workflow benchmark  
Evidence status: directional; live cross-product performance runs are not yet complete

## Executive summary

Ray Sandbox OARC is strongest as an explainable and auditable memory control plane. Its distinctive capabilities are transparent multi-arm retrieval, temporal and graph-aware recall, evidence-linked observations, snapshots, project-scoped audit history, and a PostgreSQL-backed event path.

The compared products are generally ahead in hosted production delivery, ecosystem integrations, operational maturity, collaborative evaluation, and ready-made model-provider routing. The recommended position is not to copy every competitor. It is to become the auditable, project-scoped memory and evaluation layer for Codex and other AI agents.

This document does not claim that one product is faster or more accurate than another. Those claims require matched live runs using the same corpus, model, prompt, temperature, tool budget, and timeout.

## Current app baseline

### Verified locally

- Retain, recall, reflect, consolidation, evaluation, snapshots, local benchmarks, and integration-event normalization.
- Recall combines semantic, BM25 keyword, graph-spreading, and temporal retrieval, followed by rank fusion, reranking, boosts, and token-budget packing.
- A synthetic Codex event was accepted through the scoped local development-principal path, persisted in PostgreSQL, queued, and shown in audit event history.
- The audit page Date rendering failure and stale process-local capture-status display were fixed and targeted tests/typecheck passed.

### Not yet verified

- Automatic capture of the real Codex desktop conversation.
- Meaningful worker completion and canonical-record extraction from a live event.
- Matched four-mode live benchmark.
- Authenticated Playwright/axe E2E.
- Production load, restore, rollback, and deployment validation.

## Memory-platform comparison

| Platform | Main workflow | Relative strength | Relative weakness versus OARC |
|---|---|---|---|
| Mem0 | Extract memories from conversations, store them through an API, and retrieve them for future prompts. | Simple integration, broad model/database support, and fast adoption path. | Less visibly focused on the full audit/replay/temporal-governance surface in the current comparison. |
| Zep | Build a persistent agent memory layer with user/session context, retrieval, and hosted or self-managed operational services. | Production-oriented memory service, graph/context emphasis, and operational maturity. | OARC exposes more of its retrieval reasoning and project-audit state directly in the UI. |
| Letta / MemGPT | Give an agent explicit memory blocks, archival memory, and tool-driven memory management. | Strong agent-state model and long-running autonomous-agent workflow. | More agent-runtime-centric; OARC is more focused on governed project memory and comparative evaluation. |
| OpenMemory | Provide an open/local memory layer and APIs for storing and recalling agent context. | Local control, open deployment model, and developer flexibility. | OARC currently offers richer built-in audit, snapshot, benchmark, and retrieval-trace concepts. |
| Memori | Extract structured long-term memories from interactions and make them available to applications or agents. | Structured memory orientation and application integration. | OARC has a more explicit multi-arm retrieval and project-event audit model. |

### Memory verdict

OARC is ahead conceptually in transparency, temporal reasoning, graph tracing, and governance visibility. The competitors are ahead in deployment maturity, integration breadth, documentation, and production operating history. OARC’s highest-impact upgrade is a real Codex connector plus worker-backed extraction and reliable multi-tenant production operation.

## Prompt and context-platform comparison

| Platform | Main workflow | Relative strength | Relative weakness versus OARC |
|---|---|---|---|
| LangSmith | Trace model and tool calls, version prompts, run datasets, evaluate outputs, and inspect failures. | End-to-end tracing, dataset evaluation, and ecosystem integration. | OARC is more memory-domain-specific and exposes memory provenance more directly. |
| Braintrust | Define experiments and scorers, run evaluations, compare model or prompt variants, and monitor production quality. | Strong evaluation workflow, scoring, regression detection, and team collaboration. | OARC has deeper built-in memory semantics but less mature hosted evaluation operations. |
| PromptLayer | Version, test, observe, and manage prompts across model calls. | Prompt registry, versioning, and observability. | OARC connects prompt tests directly to its own memory and recall settings; PromptLayer is broader as a prompt-operations product. |
| Humanloop | Collaboratively design prompts, collect feedback, evaluate generations, and manage production prompt versions. | Human feedback loop, team workflow, and production prompt management. | OARC offers more transparent retrieval mechanics but less collaborative production tooling. |
| DSPy | Represent language-model behavior as programs and optimize prompts or demonstrations against a metric. | Programmatic optimization and metric-driven prompt compilation. | OARC is easier to inspect operationally; DSPy is stronger for automated prompt optimization. |

### Prompt/context verdict

OARC’s Context Tuning is strong for explaining how memory enters a prompt: token budget, retrieval depth, reranking, recency, time, proof, entity signals, filters, and history policy. The major gap is that it does not yet provide the same mature hosted trace, team collaboration, scorer marketplace, and automated optimization capabilities as the leading platforms.

## Feature-level scorecard

Scores are directional capability judgments, not measured performance scores.

| Capability | OARC | Best comparison products | Finding |
|---|---:|---|---|
| Explainable memory retrieval | Strong | OARC | Four retrieval arms, trace, scores, boosts, and selected context are visible. |
| Temporal memory | Strong | OARC / Zep | OARC has explicit temporal intent and history handling; live quality still needs benchmarking. |
| Graph relationships | Strong | OARC / Zep | OARC exposes graph spreading and relationship types. |
| Evidence and provenance | Strong locally | LangSmith / Braintrust operationally | OARC has project audit and evidence links; hosted observability is less mature. |
| Prompt versioning | Medium | PromptLayer / Humanloop | OARC supports drafts, versions, compare, and test runs, but with a smaller collaboration surface. |
| Context controls | Strong | OARC | OARC has detailed memory-specific controls. |
| Agent-native memory | Medium | Letta / MemGPT | OARC has MCP and Codex event contracts but live Codex capture remains pending. |
| Evaluation | Medium | LangSmith / Braintrust / DSPy | OARC has deterministic retrieval evaluation; competitor ecosystems are broader. |
| Snapshots and rollback | Strong locally | OARC | Local checkpoint, diff, restore, and safety snapshot are useful; production backup/restore is pending. |
| Hosted production maturity | Pending | Zep / Mem0 / LangSmith | OARC needs deployment, load, restore, monitoring, and security evidence. |

## Highest-impact upgrades

1. Complete the real Codex host connector with stable IDs, redaction, retries, scoped authentication, and tool-result capture.
2. Make the worker path observable from queued through processed, extracted, governed, and failed states.
3. Add the matched four-mode benchmark and persist all run metadata, including capture state and queue delay.
4. Add authenticated Playwright and axe coverage for audit, benchmark, export, keyboard navigation, and responsive layouts.
5. Add production-grade tracing, cost tracking, provider routing, rate limits, backup/restore, and rollback validation.
6. Add automated prompt/context optimization on top of the existing deterministic recall trace, borrowing the strongest idea from DSPy and the evaluation platforms.

## Recommended controlled benchmark

Use one redacted corpus and keep these fixed:

- model and model version;
- system and user prompt version;
- temperature and sampling settings;
- tool budget and timeout;
- task order and randomization seed;
- tenant, bank, and project scope;
- evaluation rubric.

Compare:

1. without-memory;
2. local-memory;
3. postgres-memory;
4. manifest-memory.

Record:

- answer score;
- citation precision;
- unsupported-claim rate;
- retrieval recall and precision;
- p50 and p95 latency;
- queue delay;
- input and output tokens;
- memory writes and reads;
- capture status;
- worker failures;
- cost per task.

Do not use vendor-published scores as substitutes for this matched run. They are useful directional references, but each vendor may use a different model, corpus, prompt, metric, or test harness.

## Sources and evidence notes

Official product documentation should be checked before converting any capability claim into a final purchasing or architecture decision:

- Mem0: https://docs.mem0.ai/
- Zep: https://help.getzep.com/
- Letta: https://docs.letta.com/
- OpenMemory: https://github.com/CaviraOSS/OpenMemory
- Memori: https://github.com/MemoriLabs/Memori
- LangSmith: https://docs.smith.langchain.com/
- Braintrust: https://www.braintrust.dev/docs
- PromptLayer: https://docs.promptlayer.com/
- Humanloop: https://humanloop.com/docs
- DSPy: https://dspy.ai/

Vendor documentation is evidence of documented capability, not independent proof of reliability, accuracy, security, or performance. Those properties require a matched test.

## Final decision

OARC should compete on trustworthy memory operations rather than generic prompt management. The best near-term sequence is:

```text
real Codex connector
→ worker completion evidence
→ matched four-mode benchmark
→ authenticated browser QA
→ production hardening
```

Until that sequence is complete, describe OARC as a strong local memory-and-evaluation prototype with a partially wired durable project-memory runtime—not as a fully benchmarked production competitor.
