# Enterprise Visual Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated, interactive enterprise UI gallery for comparing a command center, evidence table, and memory topology without altering canonical evidence behavior.

**Architecture:** A client-only gallery route owns a bounded synthetic simulator and exposes its state to focused template components. Existing OARC tokens and primitives provide visual consistency; no server API, PostgreSQL, connector, or authenticated operator component imports the gallery.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, existing OARC UI primitives and SVG rendering, Vitest, Playwright, axe-playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-enterprise-visual-gallery-design.md`

## Global Constraints

- The gallery route is `/sandbox/design-gallery` and all displayed values state `Synthetic preview data`.
- Keep the gallery isolated from PostgreSQL, evidence APIs, connector routes, and production authentication.
- Use the existing dark OARC token system; do not introduce a generic light/white dashboard.
- No new runtime dependency in the first pass.
- Support keyboard interaction, reduced motion, and 375/768/1440 widths.
- Do not commit, push, deploy, or alter existing production-facing evidence behavior.

## Review Focus

- Pausing must stop synthetic updates and visibly report the paused state; covered in Task 1 unit test and Task 4 browser test.
- Filters that produce no rows must show an explicit empty result, not stale rows; covered in Task 2 unit test and browser test.
- Detail selection must remain coherent after sorting/filtering; covered in Task 2 unit test.
- Graph interaction must have a keyboard-accessible selection path and a text alternative; covered in Task 3 unit test and browser test.
- Reduced motion must remove synthetic animation without hiding data or controls; covered in Task 4 browser test.

---

### Task 1: Bounded synthetic command-center state

**Files:**
- Create: `lib/design-gallery.ts`
- Create: `tests/runtime/design-gallery.test.ts`

**Interfaces:**
- Produces: `createGallerySnapshot(seed: number): GallerySnapshot`, `advanceGallerySnapshot(snapshot: GallerySnapshot): GallerySnapshot`, and `filterEvidenceRows(rows: readonly EvidenceRow[], query: string, severity: SeverityFilter): EvidenceRow[]`.
- Consumes: no runtime store, API, or database client.

- [ ] **Step 1: Write failing unit tests**

Assert that advancing a snapshot changes its `lastUpdatedAt` and at least one time-series point, preserves bounded data length, and that `filterEvidenceRows` returns an explicit empty array for an unmatched query.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/runtime/design-gallery.test.ts`

Expected: FAIL because `lib/design-gallery.ts` does not export the gallery contracts.

- [ ] **Step 3: Implement pure gallery data contracts**

Implement deterministic seed data and bounded snapshot advancement in `lib/design-gallery.ts`. Keep all copy and values marked as synthetic; do not read browser storage or a server service.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx vitest run tests/runtime/design-gallery.test.ts`

Expected: PASS.

### Task 2: Interactive command-center and evidence-table templates

**Files:**
- Create: `components/design-gallery/CommandCenterTemplate.tsx`
- Create: `components/design-gallery/EvidenceTableTemplate.tsx`
- Modify: `tests/runtime/design-gallery.test.ts`

**Interfaces:**
- Consumes: `GallerySnapshot`, `EvidenceRow`, and `filterEvidenceRows` from `lib/design-gallery.ts`.
- Produces: `CommandCenterTemplate` and `EvidenceTableTemplate` client components with testable labels for range, pause state, filter, sort, selected row, and empty results.

- [ ] **Step 1: Extend the failing unit test**

Add tests that sorting is stable for equal values and that a selected evidence row remains selected only while it is visible after filtering.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/runtime/design-gallery.test.ts`

Expected: FAIL because sorting/selection helpers are absent.

- [ ] **Step 3: Implement the two templates and minimal pure helpers**

Use existing OARC cards, tabs, badges, buttons, and SVG chart conventions. Include chart series toggles, range selection, pause/play controls, chart tooltip/focus state, semantic table controls, a selected-row detail panel, and an explicit `No matching evidence` state.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx vitest run tests/runtime/design-gallery.test.ts`

Expected: PASS.

### Task 3: Accessible memory-topology template

**Files:**
- Create: `components/design-gallery/MemoryTopologyTemplate.tsx`
- Modify: `tests/runtime/design-gallery.test.ts`

**Interfaces:**
- Consumes: `TopologyNode` and `TopologyEdge` contracts from `lib/design-gallery.ts`.
- Produces: `MemoryTopologyTemplate` with `selectedNodeId: string | null` state and a text summary for the active node.

- [ ] **Step 1: Extend the failing unit test**

Add tests for selecting a known node and for resolving a meaningful text summary when a node is selected.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/runtime/design-gallery.test.ts`

Expected: FAIL because the topology selection helper is absent.

- [ ] **Step 3: Implement the SVG topology view**

Render focused, hoverable SVG nodes and edges with buttons or a companion list for keyboard selection. Include pan/zoom controls only if they can stay operable at mobile widths; otherwise provide fit/reset and node-selection controls. Respect `prefers-reduced-motion` before animating edges.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx vitest run tests/runtime/design-gallery.test.ts`

Expected: PASS.

### Task 4: Gallery route, navigation, and browser verification

**Files:**
- Create: `app/sandbox/design-gallery/page.tsx`
- Create: `components/design-gallery/EnterpriseVisualGallery.tsx`
- Modify: `components/shell/SandboxLayout.tsx`
- Create: `tests/e2e/design-gallery.spec.ts`

**Interfaces:**
- Consumes: all Task 1–3 contracts and templates.
- Produces: a `/sandbox/design-gallery` route and `Design gallery` navigation entry.

- [ ] **Step 1: Write the failing Playwright specification**

Cover the route title, synthetic-data disclosure, chart pause/play and range controls, table filtering/detail selection, graph node selection, visible focus, reduced motion, axe serious/critical checks, and widths 375/768/1440.

- [ ] **Step 2: Run the browser test to verify it fails**

Run: `npx playwright test tests/e2e/design-gallery.spec.ts --project=chromium`

Expected: FAIL because `/sandbox/design-gallery` and its controls do not exist.

- [ ] **Step 3: Implement the route and bounded simulator**

Mount a client-owned timer in `EnterpriseVisualGallery` that advances only synthetic data, cleans up on unmount, and pauses cleanly. Add a clearly named `Design gallery` navigation item under System. Do not add the gallery to operator evidence routes.

- [ ] **Step 4: Run focused browser verification**

Run: `npx playwright test tests/e2e/design-gallery.spec.ts --project=chromium --project=mobile`

Expected: PASS at all required widths with no serious or critical axe violations.

- [ ] **Step 5: Run final validation**

Run: `npm test; npm run typecheck; git diff --check`

Expected: all tests pass, typecheck exits 0, and diff check reports no whitespace errors.
