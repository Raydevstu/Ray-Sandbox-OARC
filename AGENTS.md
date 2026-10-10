# Ray Sandbox OARC — Tier-1 Engineering Operating Contract

## Project identity and source of truth

The substantive project is `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`. Do not confuse it with an outer workspace or another process listening on a familiar port. Confirm the repository root, branch, package, page identity, and intended runtime before changing or validating anything.

Read documentation in this order:

1. `docs/superpowers/PROJECT-CORE-HEART.md`
2. the canonical blueprint named by the Core Heart
3. the current dated roadmap
4. the newest relevant handoff
5. task-specific plans, contracts, tests, and migrations

Historical blueprints and handoffs are evidence, not superseded instructions. Preserve them unless a task explicitly authorizes archival or deletion.

## Architecture invariants

- PostgreSQL is the canonical durable store for production behavior. Local engine or browser state is simulation unless explicitly labeled otherwise.
- Every derived memory and graph relationship must link to immutable source evidence.
- Every durable mutation must create an event-ledger record with correlation and idempotency information.
- Preserve tenant, bank, project, conversation, user, agent, app, and run scope at every boundary that supports it. Unknown scope must fail closed.
- Time is first-class: retain observation, validity, invalidation, supersession, confidence, and review state.
- Historical evidence is append-only. Correct through revision, supersession, invalidation, restoration, or deletion workflow; never silently rewrite it.
- Provider extraction can submit proposals only. Schema validation, policy checks, conflict handling, and the governed pipeline decide canonical persistence.
- Connectors and observability integrations are adapters, never alternative memory sources of truth.

## Required engineering workflow

1. Inspect the active contracts, tests, migrations, and current worktree before editing.
2. State the smallest coherent implementation boundary and preserve unrelated dirty changes.
3. Add or update focused tests before changing executable behavior.
4. Implement the minimal compatible change behind existing boundaries.
5. Run focused tests first, then typecheck and broader validation proportional to risk.
6. Inspect the final diff, affected documentation, migrations, and runtime scope.
7. Update the roadmap and handoff whenever a slice's evidence state changes.

Use two-space TypeScript indentation, semicolons, PascalCase React components, camelCase functions, and kebab-case routes/migrations. Keep API validation in schemas and database access behind repository interfaces.

## Evidence taxonomy

Use these labels precisely:

| Label | Meaning |
|---|---|
| `IMPLEMENTED` | Source code or documented contract exists. |
| `TESTED` | Focused automated test evidence exists. |
| `LOCALLY VERIFIED` | A real local runtime, database, or Docker path was exercised. |
| `BROWSER VERIFIED` | A real authenticated browser journey passed. |
| `BENCHMARK VERIFIED` | A versioned workload or corpus was measured and reported. |
| `LIVE CONNECTOR VERIFIED` | A real authorized source delivered durable, traceable evidence. |
| `PRODUCTION VERIFIED` | The actual authorized external deployment was exercised. |

Never infer a stronger label from a weaker one. A typecheck, build, HTTP `200`, synthetic fixture, local Docker container, or displayed UI is not proof of the other labels.

## Security, privacy, and reliability

- Never print, commit, paste, or log secrets, credentials, JWTs, private keys, raw transcripts, or unredacted customer content.
- Use `.env.example` as configuration reference; do not read or expose secret values to explain configuration.
- Production authentication requires real JWT issuer/JWKS configuration and `APEX_REQUIRE_JWT=true`. Development principals must remain disabled outside local development.
- Validate authorization and scope server-side for every protected read, write, export, review, and replay action.
- Treat connector payloads, model output, imported text, browser input, and tool results as untrusted.
- Redact at ingestion and telemetry boundaries. Record hashes, IDs, and metadata where possible instead of content.
- Make worker processing retry-safe and idempotent; report queued, degraded, unavailable, failed, and dead-letter states honestly.

## Database, memory, and graph rules

- Migrations must be additive and deterministic where possible; test against empty and existing PostgreSQL data.
- Verify backup safety with restore checks, schema/foreign-key/row-count validation, and representative queries. A successful dump alone is insufficient.
- Use bounded relational graph projections before proposing a graph database. Graph traversal requires scope filters, temporal filters, maximum depth, cycle protection, and evidence-backed explanation.
- Memory retrieval must state why an item was selected, supporting evidence, confidence, freshness, policy result, and relevant supersession/conflict state.
- A deletion or correction must preserve the audit history and respect retention/recovery policy.

## Testing and validation commands

- `npm test` — full Vitest suite.
- `npm run typecheck` — TypeScript validation.
- `npm run test:e2e` — browser and accessibility suite.
- `npm run staging:validate` — local Docker/PostgreSQL staging validation.
- `npm run quality:slo:workload` — local retain/recall/worker workload report.
- `npm run quality:audit:postgres` — provenance and event-ledger audit.
- `npm run quality:adversarial:report` — deterministic adversarial corpus report.
- `npm run db:verify-backup:postgres -- <dump>` — local restore-manifest verification.
- `npm run deployment:validate` — production-like local container validation only.

Run the narrowest relevant command before the broad suite. Report failures, skips, warnings, and evidence limits explicitly.

## Browser, connector, and deployment boundaries

- Browser work requires authenticated flow coverage, keyboard navigation, visible focus, reduced-motion behavior, responsive checks at 375/768/1440 widths, and serious/critical axe validation.
- A connector is not live merely because a shared contract, mock, or synthetic payload exists. Require authorized source delivery, durable provenance, retry/idempotency evidence, and deletion behavior.
- Do not deploy, publish, push, rotate credentials, authorize a connector, or modify provider configuration without explicit user authorization.
- Docker/PostgreSQL is the approved local development and staging path. External deployment verification, rollback/RPO/RTO proof, and non-local connector authorization remain frozen until explicitly resumed.

## Active execution boundary

Unless the user explicitly expands scope, continue **Slice 1 — Enterprise Evidence Integrity Baseline**: measured sustained SLO workload, exhaustive provenance and event-ledger audits, dead-letter replay-to-complete evidence, and any remaining authenticated review/events/manifest/export plus 768px accessibility validation.

## Change hygiene

Preserve user-owned dirty files. Do not reset, clean, delete, move, or overwrite unrelated changes. Never commit unless the user explicitly requests it. Before completion, inspect the diff and report the exact files changed, direct evidence, remaining gaps, and the single recommended next action.
