# Enterprise visual gallery design

## Purpose

Provide an isolated local preview page where an operator can compare modern,
interactive visual patterns before any are adopted by the canonical operator
evidence workspace. The gallery is a design preview: its data is explicitly
synthetic and must never be presented as PostgreSQL evidence or live runtime
telemetry.

## Scope

The page will be available at `/sandbox/design-gallery` and will contain three
focused, working templates:

1. **Command center**: a dark operational dashboard with live-looking bounded
   simulation, selectable time ranges, tooltips, legend toggles, and a visible
   last-updated indicator.
2. **Evidence table**: an enterprise data grid with search, severity/status
   filters, sort controls, row selection, and a detail drawer/panel.
3. **Memory topology**: an interactive graph canvas with pan, zoom, node focus,
   and reduced-motion-safe animation. It is a 2D graph for the first gallery
   pass; a 3D implementation is deferred until a selected workflow proves it
   improves comprehension over the accessible 2D view.

The visual system will keep the existing dark OARC tokens, avoid a generic
white dashboard appearance, and use distinct visual hierarchy, compact
operational density, glass/gradient accents, keyboard-accessible controls, and
honest synthetic-data labeling.

## Architecture

- A client component owns only synthetic gallery state and a bounded interval
  simulator. It is never imported by server evidence routes.
- Existing `Card`, `Button`, `Badge`, `Segmented`, and SVG chart primitives
  remain the base visual language.
- The first pass uses no new runtime dependency: this limits bundle risk and
  lets the user compare interaction patterns before selecting ECharts,
  TanStack Table, React Flow, or React Three Fiber for a product path.
- The route is added to the Sandbox navigation only after the preview exists;
  it does not replace `/sandbox` or `/sandbox/operator`.

## Interaction and accessibility

- Chart series can be toggled and show values by pointer and keyboard focus.
- The simulator can be paused and exposes the most recent update time.
- Tables are semantic, sortable, filterable, searchable, and have an explicit
  selected-row detail state.
- The graph has buttons to select nodes, a text alternative summary, and
  disables animation when reduced motion is requested.
- Responsive targets are 375, 768, and 1440 CSS pixels; controls retain
  visible focus and serious/critical axe violations are not accepted.

## Error and truthfulness rules

- Every template displays `Synthetic preview data` and no control references a
  production store, authenticated evidence endpoint, or live connector.
- A paused simulator is visibly paused, and empty filtered results are explicit.
- No real-time or production claim is made from this gallery.

## Verification

- Unit tests cover range selection, filter/sort behavior, paused simulation,
  and synthetic labeling.
- Browser coverage verifies chart interaction, table detail selection,
  graph-node selection, keyboard focus, reduced motion, and 375/768/1440
  layouts.
- Typecheck and the full test suite run before the feature is called complete.

## Non-goals

- No PostgreSQL reads or writes.
- No production authentication or route changes.
- No connector, provider, deploy, push, or commit.
- No claim that a static sample is a live operational dashboard.
