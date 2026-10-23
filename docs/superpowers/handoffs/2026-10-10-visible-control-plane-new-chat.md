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
