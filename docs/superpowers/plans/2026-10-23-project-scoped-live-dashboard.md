# Project-Scoped Live Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every Dashboard seed/local-state panel with one authorized project's durable and live server data, with optional accessible 3D visualization.

**Architecture:** JWT project authorization protects a typed dashboard service. The service combines bounded live runtime observations with canonical project records and publishes snapshot/SSE responses. React renders all panels from that single contract and falls back to accessible SVG/table views.

**Tech Stack:** Next.js App Router, TypeScript, Zod, React, Zustand only for selected UI state, Vitest, Playwright, CSS/SVG; React Three Fiber only after its isolated performance/accessibility gate passes.

**Spec:** `docs/superpowers/specs/2026-10-23-project-scoped-live-dashboard-design.md`

## Global Constraints

- Every Dashboard value is project-scoped server data or an explicit empty/unavailable state.
- JWT `allowed_project_ids` is enforced server-side for all project dashboard endpoints.
- Do not send request content, secrets, JWTs, or raw MCP arguments into telemetry.
- Existing unscoped `/api/runtime-metrics` remains a local diagnostic only.
- 3D is progressive enhancement; SVG/table fallback and reduced-motion behavior are required.
- Preserve unrelated dirty work; do not commit unless explicitly requested.

## Review Focus

- A request for a permitted tenant but unpermitted project must fail closed and clear existing data.
- A project switch must not display old-project snapshots while the next stream connects.
- An empty project must remain visibly empty rather than showing a seeded zero-history graph.
- A missing stage measurement must display unavailable, not zero milliseconds.
- WebGL failure, hidden tab, or reduced motion must leave all live status and data usable through SVG/text/table controls.

### Task 1: Project claim and scope enforcement

**Files:**
- Modify: `lib/auth/*`, `lib/runtime/mcp/sessions.ts`, `app/api/mcp/route.ts`
- Test: `tests/runtime/auth*.test.ts`, `tests/runtime/mcp-route.test.ts`

**Interfaces:** Produces `Principal.allowedProjectIds: readonly string[]` and `authorizeProject(principal, scope)`.

- [ ] Write failing tests for an allowed project, missing allow-list, and a cross-project MCP initialization attempt.
- [ ] Run focused tests; confirm missing project authorization fails.
- [ ] Parse `allowed_project_ids`, validate it as non-empty strings, and enforce it before session creation/read/write access.
- [ ] Re-run focused tests; confirm allowed project succeeds and all other projects fail closed.

### Task 2: Project runtime registry and durable snapshot service

**Files:**
- Create: `lib/runtime/project-dashboard-metrics.ts`, `lib/runtime/project-dashboard-service.ts`
- Modify: `lib/runtime/live-metrics.ts`, `lib/runtime/api-handlers.ts`, `app/api/mcp/route.ts`, queue/worker dispatcher boundaries
- Test: `tests/runtime/project-dashboard-metrics.test.ts`, `tests/runtime/project-dashboard-service.test.ts`

**Interfaces:** Produces `recordProjectOperation(scope, observation)`, `setProjectQueueState(scope, state)`, and `readProjectDashboardSnapshot(scope, projectId)`.

- [ ] Write failing derivation tests for real operation series, outcomes, p50/p95, measured stage timing, queue state, MCP tool totals, bounded history, and no-content telemetry.
- [ ] Write failing service tests for durable network mix, confidence, event summaries, and empty/unavailable distinctions.
- [ ] Run focused tests; confirm modules are absent.
- [ ] Implement the partitioned registry and service using the canonical repository under the exact project scope.
- [ ] Re-run focused tests; confirm all snapshot fields derive from supplied server records only.

### Task 3: Protected snapshot and SSE routes

**Files:**
- Create: `app/api/project-dashboard/route.ts`, `app/api/project-dashboard/stream/route.ts`
- Test: `tests/runtime/project-dashboard-route.test.ts`

**Interfaces:** Consumes `projectId` query parameter and authenticated principal; returns `ProjectDashboardSnapshot` or stable unauthorized/unavailable state.

- [ ] Write failing route tests for valid snapshot, initial SSE event, stream update, unauthorized project, missing project, store unavailable, and no cross-project response cache.
- [ ] Run route tests and confirm failure because the routes are absent.
- [ ] Implement authenticated no-store snapshot and SSE routes with heartbeat and cleanup.
- [ ] Re-run route tests and confirm all scoped failures and updates pass.

### Task 4: Project selector and client stream state

**Files:**
- Create: `lib/runtime/use-project-dashboard.ts`, `components/oarc-v2/project-dashboard-selector.tsx`
- Modify: `app/sandbox/page.tsx`
- Test: `tests/e2e/project-dashboard.spec.ts`

**Interfaces:** Produces `{ projectId, snapshot, status, selectProject }` where selection clears stale data before opening SSE.

- [ ] Write a failing browser test for project selection, loading, Live/Stale/Disconnected/Empty status, and no old-project values after switching.
- [ ] Run the browser test and confirm failure because the selector/client boundary is missing.
- [ ] Implement project selection from authorized projects, fetch/SSE lifecycle, freshness timer, and explicit error states.
- [ ] Re-run browser test and confirm pass.

### Task 5: Replace every Dashboard panel

**Files:**
- Modify: `app/sandbox/page.tsx`, `components/oarc-v2/live-observability-chart.tsx`, `components/charts/*`
- Test: `tests/e2e/project-dashboard.spec.ts`, focused component tests as needed

**Interfaces:** Consumes only `ProjectDashboardSnapshot`; removes dashboard reads of `seedMetrics`, `opsSeries`, `metrics`, `events`, `offlineQueue`, `integrationEvents`, and `webhookDeliveries`.

- [ ] Write failing tests that assert every named panel renders snapshot data, explicit empty/unavailable copy, and an accessible table alternative.
- [ ] Run targeted tests; confirm legacy seeded/local panels fail the assertions.
- [ ] Bind KPI, network, operational, latency, health, queue, recall-stage, and event panels to the scoped snapshot; delete misleading `live` copy and seeded sparklines from Dashboard usage.
- [ ] Re-run targeted tests and confirm no Dashboard panel derives a metric from the browser seed store.

### Task 6: Progressive 3D data visualization

**Files:**
- Create: `components/oarc-v2/project-runtime-topology.tsx`
- Modify: `app/globals.css`, `app/sandbox/page.tsx`
- Test: `tests/e2e/project-dashboard.spec.ts`

**Interfaces:** Consumes network/operations/queue values and returns SVG fallback plus optional lazy 3D topology.

- [ ] Write failing tests for status-linked visual state, SVG fallback, keyboard-visible detail, reduced-motion mode, and hidden-tab pause.
- [ ] Run focused browser tests and confirm the visual contract is absent.
- [ ] Spike React Three Fiber in an isolated lazy component; retain it only if it meets the spec performance/accessibility gate, otherwise implement the SVG topology as the shipped solution.
- [ ] Re-run browser tests at 375/768/1440 and confirm live data remains readable without WebGL.

### Task 7: Evidence, documentation, and verification

**Files:**
- Modify: `app/sandbox/docs/page.tsx`, `docs/superpowers/handoffs/2026-10-23-hermes-opencode-mcp-next-chat.md`, `docs/superpowers/roadmaps/*`

- [ ] Document the scoped token claim, Dashboard states, visual fallback, and evidence limits.
- [ ] Run focused runtime tests, `npm run typecheck`, targeted E2E, then full `npm test` and `npm run test:e2e`.
- [ ] Exercise an authorized local project operation and verify the scoped dashboard changes through SSE in a browser.
- [ ] Record IMPLEMENTED/TESTED/LOCALLY VERIFIED/BROWSER VERIFIED evidence and any remaining production limits.

## Self-Review

Tasks 1-5 cover every panel and the server authorization/data path. Task 6 makes 3D optional rather than a source of truth. Task 7 prevents local proof from becoming production evidence. Review Focus items map to Tasks 1, 3, 4, 5, and 6.
