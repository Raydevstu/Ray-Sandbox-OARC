# Ray Sandbox OARC V2 — UI Design and Rendering Implementation Blueprint

Status: DESIGN ONLY — approved for implementation planning, not yet implemented
Branch: `V2-design`
Product: Ray Sandbox OARC, an agent-memory orchestration and observability workspace

## 1. Design decision

V2 is a high-density operational workspace, not a marketing dashboard. The primary job is to let an operator understand what the memory system knows, why a result was retrieved, whether the runtime is healthy, and what action is safe next.

The visual direction is **Data-Dense OARC Observatory**:

- dark-first, with the existing OARC violet/blue/green/amber semantic palette;
- dense but calm information hierarchy; no decorative glass effects that reduce legibility;
- graph, timeline, retrieval evidence, and health state are first-class surfaces;
- motion explains state changes and flow, never competes with evidence;
- every chart has a textual/table fallback and every live stream has pause/resume.

The existing `app/sandbox` shell and CSS token system remain the foundation. V2 should extend the system rather than replace the visual language with a second unrelated theme.

## 2. Research inputs and constraints

The local UI/UX Pro Max design-system search selected:

- Data-Dense Dashboard pattern;
- balanced variance `6/10`, standard motion `7/10`, dense layout `8/10`;
- Fira Code/Fira Sans as a technical dashboard pairing;
- 150–300 ms control transitions and 300–450 ms staged content entrance;
- visible focus, 4.5:1 text contrast, keyboard operation, and reduced-motion support.

Focused chart guidance recommends:

- SVG line/area charts for fewer than 1,000 points;
- Canvas plus downsampling for high-volume streams;
- a streaming area chart for live retrieval telemetry;
- direct labels, line styles, markers, and a data table rather than color-only meaning;
- explicit pause, zoom, reset, and current-value status for live charts.

Focused accessibility guidance requires:

- native buttons for chips and controls with `aria-pressed` where applicable;
- visible focus rings and logical tab order;
- one contextual `role="status"` announcement for meaningful live changes;
- focus never hidden behind sticky shell elements;
- accessible names for all icon-only controls.

Live web research identified the following open-source candidates. They are references and integration options, not instructions to copy assets blindly:

- Apache ECharts: https://github.com/apache/echarts — preferred candidate for high-volume interactive charts if the bundle/performance budget permits;
- Recharts: https://github.com/recharts/recharts — preferred candidate for small, composable React SVG charts;
- D3: https://github.com/d3/d3 — use only for visualizations that cannot be expressed by the primary chart layer;
- Lucide: https://github.com/lucide-icons/lucide — existing project dependency and the canonical icon set;
- Rive examples: https://github.com/rive-app/awesome-rive — optional reference for a small number of state illustrations, not a dependency by default;
- Lottie community: https://lottie.github.io/ — optional source for static/controlled empty-state assets, subject to asset-level license review;
- developer asset index: https://github.com/bradtraversy/design-resources-for-developers — discovery only; each selected asset must be license-checked before inclusion.

No third-party asset should be downloaded into the repository until its license, attribution requirement, file size, and modification rights are recorded in `docs/assets/THIRD_PARTY_ASSETS.md`.

## 3. Experience architecture

### 3.1 Shell

`SandboxLayout` becomes a persistent application shell with five regions:

1. **Global rail** — brand, workspace switcher, primary navigation, collapse control.
2. **Context bar** — active memory scope, runtime mode, database health, last sync, command/search trigger.
3. **Main canvas** — route content with a stable max-width and responsive grid.
4. **Evidence drawer** — retrieval traces, citations, event details, and raw payload preview.
5. **Operator footer/status line** — connection state, stream state, keyboard hints, and non-blocking announcements.

The evidence drawer must be deep-linkable and closable with Escape. It must not steal focus unless opened by an explicit user action.

### 3.2 Primary routes

| Route | V2 responsibility | Signature interaction |
|---|---|---|
| `/sandbox` | operational overview | filterable KPI grid and live system pulse |
| `/sandbox/memory` | retain/recall workbench | query, trace, citations, compare modes |
| `/sandbox/context` | layered context composition | inspect, pin, reorder, token budget |
| `/sandbox/orchestrator` | graph and routing | select node, inspect edge, replay route |
| `/sandbox/benchmarks` | benchmark evidence | run/pause/export comparison |
| `/sandbox/integrations` | adapters and event flow | connection test and event inspector |
| `/sandbox/settings` | runtime/operator controls | mode, health, animation, density, access |

### 3.3 Responsive behavior

- `375–767px`: one-column canvas, collapsible rail, evidence drawer becomes a bottom sheet, charts use a minimum readable height of 220px.
- `768–1023px`: two-column content grid, compact rail, drawer overlays the canvas.
- `1024–1439px`: persistent rail and two/three-column dashboard grid.
- `1440px+`: rail, context bar, three-column data grid, optional persistent evidence drawer.

No route may require horizontal scrolling. Graph canvases may pan internally but must expose zoom/reset controls and a text alternative.

## 4. Token and visual system

Retain the existing `--bg`, `--surface`, `--border`, `--text`, `--muted`, `--accent`, `--world`, `--experience`, `--observation`, `--opinion`, `--ok`, `--warn`, and `--danger` tokens. Add semantic tokens rather than raw colors in components:

```css
:root {
  --focus-ring: hsl(190 95% 68%);
  --chart-grid: color-mix(in srgb, var(--border) 56%, transparent);
  --chart-primary: #38bdf8;
  --chart-secondary: #a78bfa;
  --chart-tertiary: #34d399;
  --chart-alert: #fbbf24;
  --chart-critical: #f87171;
  --motion-fast: 160ms;
  --motion-standard: 280ms;
  --motion-enter: 420ms;
  --layout-rail: 248px;
  --layout-rail-collapsed: 72px;
  --layout-content-max: 1760px;
}
```

Typography rules:

- Fira Sans for prose, labels, and controls;
- Fira Code for IDs, timings, counts, query text, traces, and code-like values;
- minimum body size 14px in dense tables and 16px for form input;
- never use uppercase as the only distinction for status meaning;
- sentence-case labels, short headings, and visible units (`ms`, `tokens`, `facts`).

Component geometry:

- 8px spacing base;
- 12–16px card radius, 1px borders, no layout-shifting hover transforms;
- minimum interactive target 44×44px;
- focus ring: 2px, offset 2px, `--focus-ring`;
- chart cards reserve height before data loads to maintain CLS < 0.1.

## 5. Component implementation contracts

All components live under `components/oarc-v2/` grouped by feature. They are typed, composable, and independent of Zustand or the database. Data enters through explicit props or a small view-model adapter.

### 5.1 Foundation

- `OarcIconButton`: native button, required accessible label, tooltip only as supplemental text.
- `OarcStatusBadge`: text + icon/shape, supports `ok`, `warn`, `danger`, `info`, `offline`.
- `OarcCard`: title, description, actions, loading/error/empty slots.
- `OarcMetric`: value, unit, delta, direction, source timestamp, screen-reader summary.
- `OarcTabs`: URL-addressable tab state with keyboard arrow navigation.
- `OarcCommandBar`: search/shortcut entry point with an explicit command result model.
- `OarcDisclosure`: progressive detail with stable layout and announced state.

### 5.2 Evidence and memory

- `MemoryQueryComposer`: controlled query, scope selector, max token input, submit/pause/cancel state.
- `RetrievalTraceTimeline`: ordered steps for lexical, dense, graph, temporal, fusion, and budget decisions.
- `CitationList`: source title, source ID, span, confidence, timestamp, and “open evidence” action.
- `MemoryFactTable`: sortable, filterable table with a mobile card fallback.
- `ContextLayerStack`: working/episodic/semantic/parametric layers, token estimates, pin/remove/reorder actions.
- `EvidenceDrawer`: focus-managed panel that can show trace, citation, event, or raw payload tabs.

### 5.3 Graph and orchestration

- `OarcGraphViewport`: pan/zoom/reset, keyboard node navigation, selection state, loading fallback.
- `GraphNode`: semantic type, label, health, selected/focused state, reduced-motion rendering.
- `GraphEdge`: relationship label, direction, confidence, active/replayed state.
- `RouteReplayControl`: play/pause/step/reset; never auto-play on page load.
- `GraphInspector`: selected node/edge details and linked memories.

### 5.4 Charts

- `LiveRetrievalChart`: streaming area chart, capped ring buffer, pause/resume, zoom/reset, current value and text summary.
- `LatencyTrendChart`: p50/p95/p99 line series with line-style redundancy and anomaly markers.
- `MemoryLayerDistribution`: stacked bar or grouped bar, never pie for more than five categories.
- `RecallQualityChart`: benchmark score trend with table fallback.
- `ChartLegend`: selectable series controls with `aria-pressed`.
- `ChartDataTable`: visually hidden only when an equivalent visible table exists; otherwise displayed on demand.

Chart props should use domain models, not library-specific types:

```ts
export type OarcPoint = {
  readonly timestamp: number;
  readonly value: number;
  readonly label?: string;
  readonly status?: "normal" | "warning" | "critical";
};

export type OarcSeries = {
  readonly id: string;
  readonly label: string;
  readonly points: readonly OarcPoint[];
  readonly colorToken: "primary" | "secondary" | "tertiary" | "alert" | "critical";
  readonly lineStyle: "solid" | "dashed" | "dotted";
  readonly enabled: boolean;
};
```

### 5.5 Runtime and operator controls

- `RuntimeModeControl`: deterministic/runtime mode with explicit confirmation for mode changes.
- `HealthSummary`: canonical store, schema, repository, queue, and provider status.
- `StreamControl`: live/offline, last event, reconnect, pause, resume.
- `AnimationPreferences`: full, reduced, off; persisted locally and respected by CSS and JS.
- `OperatorAction`: typed action with risk level, confirmation text, and audit event.

## 6. Rendering and animation model

### 6.1 Principles

Animation is state communication. It must never hide content, block an action, or be the only indicator of health.

- initial card entrance: opacity + 8–12px translate, 300–420ms;
- list staging: 20–40ms stagger, maximum eight visible items;
- control feedback: 150–220ms;
- drawer open/close: 220–280ms transform/opacity;
- graph route replay: user-controlled, 450–900ms per edge depending on route length;
- no continuous decorative motion except a low-amplitude live pulse with pause control;
- do not animate width/height; use opacity and transform to avoid layout thrash.

### 6.2 Reduced motion

The preference order is:

1. explicit user setting;
2. `prefers-reduced-motion: reduce`;
3. default standard motion.

At reduced motion, render final state immediately, remove route replay and floating effects, retain status text and non-animated markers, and keep transitions under 100ms where feedback remains useful.

### 6.3 Animation implementation

Prefer CSS transitions and keyframes for shell-level motion. Use a small, isolated animation adapter for graph replay or complex timeline choreography. If GSAP is introduced, it must be dynamically imported, scoped to a component, cleaned up on unmount, and guarded by `matchMedia('(prefers-reduced-motion: reduce)')`.

Avoid SplitText, autoplay video, logo carousels, and unbounded particle effects in the core workspace. They add cost without improving memory observability.

## 7. Live chart data flow

```text
runtime event
  -> typed telemetry adapter
  -> bounded ring buffer (60–300 seconds)
  -> aggregation/downsampling worker when needed
  -> memoized chart view model
  -> chart renderer + current-value summary + data table
```

Rules:

- chart components receive immutable snapshots;
- a stream update must not rerender unrelated cards;
- buffer is bounded and older points are downsampled or discarded by policy;
- refresh is paused when the tab is hidden unless the operator explicitly keeps it live;
- errors render a stale-data indicator with last-known timestamp;
- disconnected state is distinct from zero values;
- every chart exposes pause/resume and reset;
- live announcements are contextual and throttled, never one announcement per point.

Initial implementation should use the existing runtime/event contracts and a lightweight SVG chart adapter. Introduce ECharts/Canvas only when a measured dataset crosses the documented point threshold or the benchmark proves SVG is insufficient.

## 8. Asset strategy

Use generated CSS/SVG primitives for OARC’s primary visual identity: graph nodes, pulses, grid, status markers, and chart highlights. This keeps the product consistent, accessible, and lightweight.

Approved open-source asset classes:

- Lucide SVG icons for interface actions;
- project-authored SVG illustrations for empty/error states;
- Rive or Lottie only for one or two optional onboarding/empty-state moments;
- no unlicensed icon packs, copied brand logos, or emoji as interface icons.

Asset intake requires:

1. source URL and repository commit/version;
2. license and attribution text;
3. local filename and usage surface;
4. optimized dimensions/file size;
5. light/dark contrast check;
6. keyboard and reduced-motion fallback;
7. entry in `docs/assets/THIRD_PARTY_ASSETS.md`.

## 9. Implementation sequence

### Slice V2.1 — visual foundations

- add semantic tokens and focus/interaction primitives;
- split shell regions into typed components;
- add responsive layout primitives;
- preserve existing routes and behavior;
- add visual regression fixtures for 375, 768, 1024, and 1440px.

### Slice V2.2 — evidence-first memory workbench

- build query composer, trace timeline, citations, context stack, and drawer;
- connect to existing retain/recall envelopes;
- add loading, empty, stale, error, and offline states;
- keyboard and screen-reader pass.

### Slice V2.3 — live observability charts

- add chart domain models and adapter boundary;
- implement latency, retrieval mix, runtime health, and queue charts;
- add pause/resume, zoom/reset, table fallback, and bounded stream buffer;
- benchmark render cost before choosing Canvas/ECharts.

### Slice V2.4 — graph motion and operator controls

- typed graph viewport and inspector;
- explicit route replay controls;
- runtime mode, health, stream, and animation controls;
- audit event for risky operator actions.

### Slice V2.5 — polish and hardening

- responsive visual QA;
- reduced-motion and keyboard QA;
- bundle analysis and lazy loading for heavy charts;
- browser E2E for retain → recall → trace → citation;
- build, lint, typecheck, test, and production smoke gates.

## 10. Definition of done

The V2 UI is ready for implementation acceptance when:

- all core controls work without a pointer;
- every icon-only action has an accessible name;
- all status changes have text and do not depend on color alone;
- every chart has a current-value summary and data-table fallback;
- live charts are bounded, pausable, resumable, and stale-aware;
- no layout shifts occur when charts or fonts load;
- reduced motion removes non-essential animation;
- 375/768/1024/1440px screenshots are legible without horizontal scroll;
- `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass;
- browser E2E proves the primary memory workflow;
- third-party assets have recorded licenses and no unreviewed downloads;
- no implementation begins on the next slice until its visual contract and acceptance test are reviewed.

## 11. Non-goals for this blueprint

- replacing the existing memory engine or PostgreSQL contracts;
- introducing a second state-management system;
- adding decorative 3D/particle effects to the operational UI;
- claiming production readiness from a local visual pass;
- selecting a chart dependency before measured rendering requirements justify it.
