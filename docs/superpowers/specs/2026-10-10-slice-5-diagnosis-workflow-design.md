# Slice 5 Diagnosis Workflow Design

Date: 2026-10-10  
Status: approved architecture; implementation plan pending

## Purpose

Complete the local developer and operator diagnostic path before introducing
additional connectors. A developer must be able to execute a single,
authenticated, project-scoped workflow from retention through evaluation. An
operator must be able to inspect its durable evidence, trace, correction,
replay, evaluation, and operational health without direct database access.

## Scope

The workflow is `retain -> recall -> trace -> correct -> replay -> evaluate`.
It uses the existing authenticated developer APIs and PostgreSQL canonical
repository. Every action carries tenant, bank, project, request/correlation,
and idempotency boundaries already required by the runtime contracts.

The work also standardizes the seven runtime states for each major developer
and operator route:

- `empty`: authenticated scope has no matching durable result.
- `queued`: a durable asynchronous outcome is accepted but not complete.
- `healthy`: a durable result is available and policy checks succeeded.
- `degraded`: a deterministic fallback or partial result is available.
- `unavailable`: the required runtime dependency cannot serve the request.
- `failed`: a request reached the runtime but could not complete.
- `unauthorized`: authentication or scope authorization failed.

## Architecture

1. Keep PostgreSQL access behind `CanonicalRepository` and existing runtime
   handlers. No operator component may query the database directly.
2. Add a small shared operational-state contract and a deterministic classifier
   at the route boundary. It converts known repository/runtime outcomes to the
   seven stable states without hiding error details or changing authorization.
3. Add an authenticated diagnosis workflow test harness that invokes the real
   route handlers in sequence with one immutable project scope. It records and
   asserts identifiers needed by subsequent calls rather than manufacturing
   cross-route state.
4. Wire each operator subsection to its authenticated route response and make
   the state visible, keyboard reachable, responsive, and readable with
   reduced motion. The workspace remains diagnostic; it is not a second write
   path.

## Data and security invariants

- All reads and mutations fail closed on a missing or mismatched tenant, bank,
  or project scope.
- The trace query applies `projectId` to retrieval, not merely its response.
- Corrections retain revision, evidence, event-ledger, correlation, and
  idempotency history.
- Replay and evaluation are scoped to the source run/project and never promote
  a result solely because it was returned by a provider or fixture.
- Operational responses expose safe status and request IDs only; they do not
  disclose credentials, raw provider payloads, or unredacted evidence.

## Tests and evidence

- Focused route and repository tests cover the complete PostgreSQL workflow,
  project isolation, and all seven states.
- Integration tests run the authenticated SDK/API sequence against local
  PostgreSQL and assert durable readback.
- Playwright covers a real operator diagnosis journey at 375, 768, and 1440
  widths with keyboard navigation, visible focus, reduced motion, and no
  serious or critical axe findings.
- Completion evidence is limited to `IMPLEMENTED`, `TESTED`, `LOCALLY
  VERIFIED`, and `BROWSER VERIFIED` where direct checks succeed. This design
  does not authorize external connectors or production deployment.

## Non-goals

- No connector credentials, provider configuration, GitHub integration,
  collaboration integration, deployment, or production verification.
- No direct database access from browser components.
- No broad rework of the existing repository or authentication architecture.
