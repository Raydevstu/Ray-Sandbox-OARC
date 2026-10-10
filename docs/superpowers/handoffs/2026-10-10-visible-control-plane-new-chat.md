# Visible Control-Plane Integration — New Chat Handoff

## Objective

Make the locally verified Slice 1–5 control-plane capabilities visibly inspectable in the local application without weakening authentication, fabricating scope, or treating the legacy sandbox demo as canonical PostgreSQL evidence.

## Read first

1. `docs/superpowers/PROJECT-CORE-HEART.md`
2. `docs/superpowers/blueprints/2026-10-10-apex-evidence-driven-control-plane-blueprint.md`
3. `docs/superpowers/roadmaps/2026-10-10-progress-roadmap.md`
4. This handoff
5. `docs/superpowers/handoffs/2026-10-10-apex-control-plane-next-chat.md`
6. `docs/superpowers/plans/2026-10-10-slice-5-developer-api-operator-ux.md`

## Current verified state

- Local Docker staging is running at `http://127.0.0.1:3028`; PostgreSQL is the canonical local durable store.
- The landing page and `/sandbox/memory` are the pre-existing deterministic, browser-local study sandbox. Their stable visual appearance does **not** prove or disprove control-plane changes.
- The protected operator view `/sandbox/operator/events` renders `unauthorized` for an ordinary browser session. This is correct fail-closed behavior: a query string alone must not establish principal or project scope.
- The current focused authenticated browser check passed `6/6` on local staging:
  - `tests/e2e/developer-diagnosis.spec.ts` proves `retain → recall → trace → correct → replay → evaluate`.
  - `tests/e2e/operator-workspace.spec.ts` proves responsive/focus/axe state coverage and scoped operator data rendering in the authenticated test identity.
- The manually queried authenticated events route returned `200` durable events for the seeded staging project. The operations route returned `401` when queried without its required `jobs:claim` permission; this is expected authorization behavior, not a runtime failure.
- Prior final local regression evidence remains: Vitest `74` files / `247` tests passed with `6` skipped; serial Chromium/mobile Playwright `24/24` passed; staging validation passed; PostgreSQL audit found `124` records and `1,076` events with full provenance and mutation-ledger coverage.

## User-visible gap to close

The user cannot manually inspect authenticated durable evidence in their regular local browser because there is no safe local identity bridge or explicit development sign-in surface. The browser therefore sees the legacy demo or an intentional `unauthorized` operator state. Do not describe the platform as fully user-facing complete until this inspectability gap is addressed and browser-verified.

## Implementation boundary

Implement the smallest local-development-only identity bridge and operator evidence dashboard that:

1. Requires an explicitly enabled local-development configuration; it must be impossible to enable in production.
2. Establishes a scoped development principal server-side; never accept tenant, bank, project, role, or scopes solely from browser query parameters.
3. Lets an operator select only approved seeded local scopes or a server-issued scoped session.
4. Shows durable, redacted summaries for health, events, trace rationale, conflicts, policies, evaluations, and replay results.
5. Clearly labels local/deterministic evidence and shows `empty`, `queued`, `healthy`, `degraded`, `unavailable`, `failed`, and `unauthorized` states.
6. Keeps every protected route protected; do not add client-side header injection or bypass authorization.
7. Makes the legacy `/sandbox/memory` distinction explicit rather than relabeling its local browser data as PostgreSQL data.

## Likely starting points

- `app/sandbox/operator/page.tsx`
- `app/sandbox/operator/[section]/page.tsx`
- `lib/runtime/operator-section-data.ts`
- `lib/runtime/auth.ts`
- `lib/runtime/config.ts`
- `app/api/project-memory/events/route.ts`
- `app/api/project-memory/evaluations/route.ts`
- `tests/e2e/operator-workspace.spec.ts`
- `tests/e2e/developer-diagnosis.spec.ts`

Read existing authentication/configuration tests before changing identity behavior. Use dependency-free, server-side session handling compatible with the existing App Router architecture; do not log, paste, or persist credentials.

## Acceptance criteria

- A local operator can deliberately enter a development-only scoped session without placing authority in a URL.
- The operator workspace displays server-sourced, durable summaries for the selected scope.
- A regular unsigned browser still receives `unauthorized` from every protected route.
- Changing a query parameter cannot cross tenant, bank, or project scope.
- The existing authenticated diagnosis journey remains green.
- New Chromium and mobile browser tests cover login/entry, scope selection, durable event/evaluation/replay readback, all applicable operational states, keyboard focus, reduced motion, 375/768/1440 widths, and no serious/critical axe issues.
- Run focused tests first, then `npm test`, `npm run typecheck`, `npm run staging:validate`, focused/full relevant Playwright, and `git diff --check`.

## Explicit non-goals and holds

- Do not rerun Gemini. The previous spend authorization is consumed; valid redacted provider sample plus human review needs renewed explicit authorization.
- Do not authorize, implement live capture for, or connect any external connector.
- Do not deploy, push, commit, read secrets, or change production authentication.
- Do not claim production, provider-quality, or live-connector evidence from this local UI work.

## Working-tree rules

- Preserve all unrelated dirty changes, `.firecrawl/`, and `test-results/`.
- Do not reset, clean, delete, or commit unless separately directed.
- Update the dated roadmap and the control-plane handoff after direct evidence changes.

## 2026-10-10 implementation result

- Added `app/api/local/operator/session` for explicit local sign-in, server-approved seeded scope selection, HttpOnly session cookies, and sign-out. The session is process-local and intentionally local-development-only; production remains JWT-only.
- Added `app/api/local/operator/evidence` for redacted canonical-store summaries covering health, events, trace rationale, conflicts, policies, evaluations, and replay results. It never accepts scope from the browser.
- Updated `OperatorWorkspace` to show the deliberate local entry point, the selected server scope, evidence summary cards, explicit unavailable/unauthorized states, and the legacy `/sandbox/memory` distinction. Operator subsection pages now derive scope from the session cookie rather than URL parameters.
- Extended authorization principals with optional bank/project bindings and applied them to protected project reads and writes. Added focused session, route, authorization, and cross-scope tests.
- Changed only local staging compose configuration to `NODE_ENV=development`; `NODE_ENV=production` still forces JWT authentication and disables the development principal.

Direct evidence from this continuation:

- TDD RED/GREEN observed for the local session contract and cross-scope route denial.
- Full Vitest: `78` files / `257` passed, `6` skipped.
- TypeScript typecheck: passed.
- Focused Playwright/axe: `4/4` Chromium/mobile cases passed at 375/768/1440 widths with reduced motion and no serious/critical violations, against the current checkout on port `3038`.
- `git diff --check`: passed with existing CRLF conversion warnings.

Remaining boundary: this browser verification used an intentionally unconfigured local SQLite runtime. It proves the local identity bridge and protected unavailable-state behavior, but not PostgreSQL durable readback. Run the same focused browser flow against rebuilt local PostgreSQL staging before upgrading the dashboard to a PostgreSQL browser-verification claim. Do not rerun Gemini, authorize connectors, deploy, push, commit, or change production authentication.

## 2026-10-10 enterprise visual gallery preview result

- Added an isolated `/sandbox/design-gallery` route and System navigation entry. It offers three intentionally synthetic comparison templates: a dark interactive command center, a filterable/sortable evidence explorer with an inspection panel, and an accessible 2D memory topology with keyboard-equivalent node selection.
- The gallery has a bounded local simulator with pause and reduced-motion behavior. It does not import canonical evidence APIs, PostgreSQL clients, connector code, or production identity paths; all displayed samples explicitly disclose `Synthetic preview data`.
- Browser evidence is limited to this visual preview: focused Chromium/mobile Playwright passed `4/4` at 375/768/1440 against the current checkout on port `3042`, including interaction, focus, reduced-motion, and serious/critical axe checks. Focused gallery units passed `5/5`; full Vitest passed `79` files / `262` tests with `6` skipped; typecheck and `git diff --check` passed (the latter with existing CRLF warnings).
- The mobile fixed sidebar now hides below `md`, allowing the gallery and existing sandbox content to remain usable at 375px. Active segmented controls now use contrast-safe foreground text.
- No 3D rendering library was added. The first pass deliberately uses a 2D topology to keep operational information accessible and allow the user to select the visual direction before accepting a WebGL bundle/performance cost.

## 2026-10-10 interactive dashboard polish result

- The existing `/sandbox` dashboard keeps its cards, layout, colors, and network mix. Its Operations timeline now uses the established bounded local telemetry component, including pause/resume, zoom, reset, chart/table fallback, hidden-tab pause, and stale-state behavior. It reacts to new local sandbox retain, recall, and reflect events; it does not manufacture a continuous live feed.
- Four-network mix rows are keyboard-selectable and retain hover emphasis. Telemetry table containers are now keyboard-focusable when scrollable, and the shared controls preserve visible-text accessible names.
- Direct verification: focused telemetry/gallery units passed `13/13`; full Vitest passed `79` files / `262` tests with `6` skipped; typecheck passed. Serial focused Chromium/mobile browser tests passed with 375/768/1440 layouts, reduced motion, keyboard/focus interaction, and no serious/critical axe violations against this checkout at port `3042`.
- Evidence boundary: this is browser-local sandbox and seeded historical data, not PostgreSQL durable telemetry, connector delivery, production monitoring, benchmark, or deployment proof. A parallel local-dev-server Playwright attempt timed out and is not counted as load/resilience evidence.
