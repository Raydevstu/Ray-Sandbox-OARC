# Ray Sandbox OARC — V2 Handoff for a New Chat

Date: 2026-10-07  
Repository: `D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice`  
Product: Ray Sandbox OARC  
Active branch: `V2-design`

## Start here

The authoritative UI document is:

`docs/superpowers/specs/2026-10-07-v2-ui-design-implementation-blueprint.md`

The implementation is intentionally incremental. V2.1 and V2.2 are complete at the source-code level. The next planned slice is V2.3: typed live observability charts with bounded telemetry buffers and accessible fallbacks.

Do not treat the old browser tabs or another application on `localhost:3001` as evidence of Ray Sandbox OARC. Verify the page title and response body after starting the nested project. The expected local URLs are:

- `http://localhost:3001/` — Ray Sandbox OARC landing page.
- `http://localhost:3001/sandbox` — interactive workspace.
- `http://localhost:3001/sandbox/memory` — evidence-first memory workbench.

## Repository and branch state

Run commands from the nested repository, not from its parent directory:

```powershell
Set-Location 'D:\Projects\RAY SANDBOX OWEN\hindsight-memory-slice'
git status --short --branch
git log -6 --oneline --decorate
```

The current expected branch is `V2-design`. The recent checkpoints are:

| Commit | Meaning |
|---|---|
| `d3807d2` | V1 checkpoint for the memory platform |
| `e14b369` | V2 observatory UI blueprint |
| `167d8a1` | V2.1 visual foundations |
| `ccd6735` | V2.2 evidence-first memory workbench |

The worktree contains an untracked `.firecrawl/` research cache. Preserve it as untracked and do not add it to commits unless the user explicitly asks for that cache to be versioned.

## What is implemented

### V2.1 visual foundations

- `components/oarc-v2/foundation.tsx` provides typed `OarcIconButton`, `OarcStatusBadge`, `OarcCard`, `OarcMetric`, `OarcResponsiveGrid`, and `OarcVisuallyHidden` primitives.
- `components/shell/ContextBar.tsx` and `components/shell/OperatorStatusLine.tsx` split shell concerns into typed regions.
- `components/shell/SandboxLayout.tsx` uses the new context bar, route title, and operator status line while preserving existing routes and behavior.
- `app/globals.css` contains semantic OARC tokens, focus-visible behavior, responsive layout rules, reduced-motion handling, and foundation component styles.
- `docs/superpowers/fixtures/v2-ui-viewports.json` defines visual regression viewport targets at 375, 768, 1024, and 1440 pixels.

### V2.2 evidence-first memory workbench

- `components/oarc-v2/evidence-workbench.tsx` contains:
  - `MemoryQueryComposer` for query, scope, token budget, submit, and state messaging;
  - `RetrievalTraceTimeline` for ordered retrieval stages;
  - `ContextLayerStack` for working, episodic, semantic, and parametric layers;
  - `EvidenceDrawer` for citation/evidence inspection.
- Supported explicit states are `ready`, `loading`, `empty`, `stale`, `error`, and `offline`.
- `app/sandbox/memory/page.tsx` wires the workbench to the existing deterministic `RecallPanel` and recall envelopes.
- Citation selection opens the evidence drawer; the existing detailed `RecallTraceView` remains available for diagnostics.
- CSS includes responsive timeline/drawer behavior, skeletons, citation strips, query composer styles, and accessible drawer states.
- No new state-management system, memory engine, PostgreSQL contract, or chart dependency was introduced.

## Validation evidence

From the nested repository:

```powershell
npm run typecheck
npm test -- --run
npm run lint
npm run build
```

Results at the handoff checkpoint:

- Typecheck: passed.
- Vitest: passed, 19 test files and 53 tests.
- Lint: exited successfully; existing non-blocking warnings remain for unused eslint-disable directives, Next.js `next lint` deprecation, and multiple lockfiles.
- Production build: passed; all routes generated successfully.

Not yet proven by this checkpoint:

- Independent browser E2E for query → recall → trace → citation.
- V2.3 chart render-cost benchmark and live-stream behavior.
- Final reduced-motion, keyboard, screen-reader, and responsive visual QA across all required routes.
- V2.5 bundle analysis and production smoke gates.

These gaps are not failures of the V2.2 local test/build gates; they are separate acceptance gates and must remain marked pending until directly executed.

## Next implementation boundary: V2.3

Implement the smallest coherent chart slice from the blueprint:

1. Inspect existing `components/charts.tsx`, `lib/engine/observability.ts`, `lib/store.ts` (`opsSeries`), and package dependencies before editing.
2. Add typed chart domain models independent of any chart library:
   - `OarcPoint` with timestamp, value, optional label, and status;
   - `OarcSeries` with stable ID, label, immutable points, semantic color token, line style, and enabled state.
3. Add a bounded immutable ring-buffer utility with an explicit point/time limit. Never create an unbounded stream or mutate incoming snapshots.
4. Add a lightweight SVG chart adapter first. Do not add ECharts, Recharts, Canvas, or D3 until a measured dataset demonstrates that SVG is insufficient.
5. Implement current-value summaries, a readable table fallback, pause/resume, reset, stale-data indication, and a distinction between disconnected and zero values.
6. Keep live announcements throttled and contextual. Respect hidden-tab pause behavior and `prefers-reduced-motion`.
7. Wire only the first useful observability surface into the existing dashboard, preferably using the current `opsSeries` contract rather than inventing a second telemetry source.
8. Add tests for ring-buffer bounds, pause/resume/reset state, stale/disconnected rendering, and table data parity.
9. Run typecheck, tests, lint, and build. Only then update this handoff and the blueprint status.

Suggested focused files, subject to inspection:

- `components/oarc-v2/observability-charts.tsx`
- `lib/runtime/telemetry.ts` or another focused chart-domain module
- `lib/runtime/ring-buffer.ts`
- `tests/runtime/telemetry.test.ts`

Keep the change focused and below the repository’s 800-line review boundary. Avoid decorative motion, a second state-management system, broad shell refactors, and premature dependency selection.

## V2 roadmap after the next slice

- V2.3: live observability charts, bounded streams, controls, table fallbacks, render-cost measurement.
- V2.4: typed graph viewport, inspector, explicit route replay, runtime/health/stream/animation controls, and audited risky actions.
- V2.5: responsive visual QA, reduced-motion and keyboard QA, bundle analysis/lazy loading, browser E2E, and final build/lint/typecheck/test/production gates.
- V2.6: cross-chat project memory palace with versioned canonical records, append-only events, provenance, generated project manifest, Codex/runtime ingestion, bounded asynchronous extraction, cross-platform import adapters, and Tier 1 accuracy evaluation.

## Next-session implementation blueprint: V2.6 project memory palace

The next new session may begin implementation from the V2.6 blueprint in `docs/superpowers/specs/2026-10-07-v2-ui-design-implementation-blueprint.md`. The goal is durable project continuity across AI chats and development tools without depending on a single chat transcript or adding synchronous work to the critical MCP path.

### Required first sequence

1. Inspect the existing PostgreSQL schema, canonical memory/event contracts, telemetry records, MCP tool envelopes, and current project documents.
2. Define and test typed `ProjectMemoryRecord` and `ConversationEvent` schemas with provenance, confidence, importance, status, supersession, and evidence fields.
3. Add an append-only project event table/migration and deterministic current-state projection. Preserve historical records; use supersession or invalidation instead of silent deletion.
4. Add a generated project memory manifest containing repository/branch/runtime state, verified evidence, pending work, risks, decisions, source references, and capture gaps. Do not expose secrets.
5. Ingest Codex MCP calls, tool results, commits, tests, builds, runtime health, and browser evidence first. Add external platform adapters only where export or connector access exists.
6. Add asynchronous bounded extraction, deduplication, confidence scoring, conflict handling, freshness invalidation, retries, and telemetry. The chat/MCP/recall request path must not wait for summarization or unbounded writes.
7. Add the audit UI and a golden multi-session fixture proving capture, replay, deduplication, supersession, stale-state handling, and missing-source reporting.
8. Run Tier 1 accuracy tests and the controlled with-memory versus without-memory benchmark before declaring the slice complete.

### V2.6 acceptance boundary

Do not claim full cross-platform memory until the evidence demonstrates: critical decisions and requirements are captured with provenance, current status and supersession are correct, event replay is deterministic, uncaptured sources are explicit, and background processing stays within the agreed latency, queue, storage, and failure budgets. The system must never invent unavailable conversation history.

### Files and likely starting points

Inspect before editing:

- existing database migrations and canonical event/retrieval modules;
- `app/api/mcp/route.ts` and `lib/runtime/mcp/sessions.ts`;
- telemetry and runtime event modules;
- current blueprint, implementation plan, and this handoff;
- existing tests for memory, MCP, telemetry, and PostgreSQL.

Keep the first change focused on contracts and persistence. Do not begin cross-platform connectors or an audit dashboard until the canonical record model and replay tests pass.

## Runtime and database context

The V1 runtime remains in the same repository. PostgreSQL is the canonical runtime store when configured. Existing commands include:

```powershell
npm run db:status:postgres
npm run db:migrate:postgres
npm run smoke:postgres
```

The deterministic browser sandbox must remain network-independent. Runtime mode must remain explicit and must not silently fall back to deterministic mode. The V2 UI work does not replace or broaden the runtime authorization, repository, retrieval, MCP, SDK, or self-healing contracts.

## New-chat operating rules

- Read the V2 blueprint and this handoff before changing code.
- Preserve unrelated worktree changes and the untracked `.firecrawl/` cache.
- Use `apply_patch` for edits.
- Prefer small, focused feature files and immutable data flow.
- Validate user input and keep all stream/context data bounded.
- Do not claim browser E2E or production readiness from typecheck/build alone.
- If the user asks to run the app, start this nested project and verify HTTP status plus page identity, not only port ownership.
- Use conventional commits for completed slices; do not commit secrets or local environment files.

## Handoff completion criteria

The next chat may consider this handoff successfully consumed when it can identify:

- the repository and active branch;
- the four relevant V2 commits;
- the exact V2.1/V2.2 implementation files;
- the commands and results already verified;
- the explicit pending browser-E2E and V2.3 boundaries;
- the `.firecrawl/` exclusion;
- the first implementation/test files for V2.3.
