# Live Runtime Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface actual local server operation telemetry on the Dashboard with honest stream status and reduced-motion-safe visual depth.

**Architecture:** A bounded in-memory runtime registry receives observations at the retain/recall and MCP server boundaries. A development-only SSE endpoint serializes aggregate snapshots. A client hook owns EventSource state and the Dashboard renders only received telemetry with CSS/SVG status-driven effects.

**Tech Stack:** Next.js App Router, TypeScript, React, Vitest, Playwright, CSS/SVG.

**Spec:** `docs/superpowers/specs/2026-10-23-live-runtime-dashboard-design.md`

## Global Constraints

- Do not generate synthetic metric samples or label browser seed data as runtime telemetry.
- Bound memory retained by the registry.
- Development-only aggregate endpoint; production fails closed pending browser authorization.
- Respect `prefers-reduced-motion: reduce`.
- Preserve all unrelated dirty work.

## Review Focus

- A failed request must increment failures and not successes.
- No new observation must leave the client `Live` after the freshness deadline.
- An unavailable stream must become `Disconnected`, not silently display prior values as current.
- A registry history overflow must retain only the configured newest observations.
- Reduced-motion users must receive no animated particles or flowing edges.

### Task 1: Runtime telemetry contract and registry

**Files:**
- Create: `lib/runtime/live-metrics.ts`
- Test: `tests/runtime/live-metrics.test.ts`

**Interfaces:** Produces `RuntimeMetricsRegistry`, `RuntimeMetricsSnapshot`, and `recordRuntimeOperation()`.

- [ ] Write failing tests for successful/failed observations, bounded history, percentile summaries, queue gauges, and MCP tool grouping.
- [ ] Run `npx vitest run tests/runtime/live-metrics.test.ts` and confirm expected failures due to missing module.
- [ ] Implement the bounded process-local registry and explicit snapshot contract.
- [ ] Re-run the focused tests and confirm pass.

### Task 2: Server instrumentation and stream route

**Files:**
- Create: `app/api/runtime-metrics/route.ts`
- Modify: `lib/runtime/api-handlers.ts`, `app/api/mcp/route.ts`
- Test: `tests/runtime/runtime-metrics-route.test.ts`, `tests/runtime/mcp-route.test.ts`

**Interfaces:** Consumes Task 1 registry; exposes `GET /api/runtime-metrics` and `GET /api/runtime-metrics?stream=1`.

- [ ] Write failing route tests for development snapshots, SSE initial event, production fail-closed behavior, and an MCP observation after a completed tool call.
- [ ] Run the focused tests and confirm expected failure because the route/instrumentation is missing.
- [ ] Add minimal timing/outcome instrumentation around real retain, recall, and MCP execution; publish snapshots without request contents or secrets.
- [ ] Re-run the focused route tests and confirm pass.

### Task 3: Browser stream client and honest Dashboard rendering

**Files:**
- Create: `lib/runtime/use-live-runtime-metrics.ts`
- Modify: `app/sandbox/page.tsx`, `components/oarc-v2/live-observability-chart.tsx`
- Test: `tests/e2e/live-dashboard.spec.ts`

**Interfaces:** Consumes `RuntimeMetricsSnapshot`; produces client status `live | stale | disconnected` and telemetry series.

- [ ] Write a failing browser test for initial disconnected state, a live snapshot state, visible status copy, responsive 375/768/1440 views, keyboard controls, and axe/reduced-motion behavior.
- [ ] Run the targeted browser test and confirm it fails because the live UI is absent.
- [ ] Implement EventSource lifecycle, freshness timer, status binding, and replacement of simulated operational charts.
- [ ] Re-run the browser test and confirm pass.

### Task 4: Status-driven visual depth and documentation

**Files:**
- Modify: `app/globals.css`, `app/sandbox/docs/page.tsx`, `docs/superpowers/handoffs/2026-10-23-hermes-opencode-mcp-next-chat.md`
- Test: `tests/e2e/live-dashboard.spec.ts`

**Interfaces:** Consumes live status class names; produces CSS/SVG depth treatment with a reduced-motion override.

- [ ] Add a failing reduced-motion assertion that active animation classes are suppressed and status remains readable.
- [ ] Run the focused browser test and confirm the motion assertion fails.
- [ ] Add lightweight status-dependent glow, edge flow, and particle styling; update docs with local-only evidence limits.
- [ ] Re-run browser test and confirm pass.

### Task 5: Verification and evidence handoff

**Files:**
- Modify: `docs/superpowers/handoffs/2026-10-23-hermes-opencode-mcp-next-chat.md`

- [ ] Run targeted runtime tests, `npm run typecheck`, the new Playwright spec, then `git diff --check`.
- [ ] Exercise a real local retain/recall or MCP call and confirm the runtime snapshot changes.
- [ ] Record evidence states and explicit limits in the handoff.

## Self-Review

All spec requirements map to Tasks 1-5. The plan keeps production authentication and durable aggregation explicitly outside this slice. Each Review Focus item is covered by Tasks 1, 2, 3, or 4.
