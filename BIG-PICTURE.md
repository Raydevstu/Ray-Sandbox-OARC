<!-- open-steps:begin -->
_Measured 2026-10-10. Stages below are based on the dated roadmap and handoff; this file does not upgrade their evidence labels._

## What this is

Ray Sandbox OARC is a local PostgreSQL-backed control plane for agent memory. It keeps source evidence, governed memories, graph relationships, retrieval traces, corrections, evaluations, and replay history together. Developers use the memory API; operators inspect health, evidence, graph paths, policies, conflicts, events, benchmarks, and exports. External deployment, provider credentials, and live non-Codex connectors remain separate authorized gates.

## What is in it

| Feature | What it does | Stage | Last worked on | Signal |
|---|---|---|---|---|
| Evidence and event ledger | Links derived records to source evidence and durable mutation events | built - not shipped (10 Oct) | 10 Oct | active |
| Temporal evidence graph | Resolves entities and returns scoped, time-aware two-hop paths | built - not shipped (10 Oct) | 10 Oct | active |
| Provider governance | Validates extraction proposals and routes review decisions | built - not shipped (10 Oct) | 10 Oct | active |
| Evaluation and replay | Persists versioned corpus reports, correction proposals, and before/after replay | built - not shipped (10 Oct) | 10 Oct | active |
| Developer API | Exposes retain, recall, trace, correct, replay, and evaluate | building (10 Oct) | 10 Oct | active |
| Operator workspace | Provides navigation and state-aware diagnostic surfaces | building (10 Oct) | 10 Oct | active |
| Codex capture | Ingests local lifecycle events with provenance and retry handling | built - not shipped (10 Oct) | 10 Oct | stable |
| External deployment and connectors | Runs authorized non-local infrastructure and live source integrations | not checked | not measured | stable |

## Worth retiring

nothing found

## What is next

- Harden Slice 1 atomic retain, isolation, review fixture, and export gaps - Tier-1 audit plan.
- Enforce project scope and complete the Slice 5 developer workflow - Tier-1 audit plan.
- Wire operator subsections to durable data and complete seven-state browser coverage - Tier-1 audit plan.
- Add the dedicated Slice 2 graph browser journey - Tier-1 audit plan.
- Obtain explicit provider authorization for Slice 3 quality measurement - frozen external scope in the canonical blueprint.

_Age and wiring measured 2026-10-10. This map preserves the evidence boundaries in the roadmap and handoff._
<!-- open-steps:end -->
