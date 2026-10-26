# Browser Dashboard Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Let the browser use the existing JWT/JWKS contract without exposing tokens to React.

**Architecture:** A same-origin session route validates a JWT then writes an HttpOnly cookie. Runtime authentication accepts bearer or cookie tokens; the Dashboard uses session metadata and cookie-backed snapshot/SSE requests.

**Spec:** `docs/superpowers/specs/2026-10-23-browser-dashboard-session-design.md`

### Task 1: Session boundary

- [ ] Add failing route/auth tests for JWT cookie authentication, redacted metadata, secure cookie flags, and logout.
- [ ] Implement `app/api/auth/session/route.ts` and cookie parsing in `lib/runtime/auth/index.ts`.
- [ ] Run focused tests and typecheck.

### Task 2: Dashboard client

- [ ] Add failing browser tests for disconnected/sign-in, authorized project selection, and old-data clearing.
- [ ] Implement the session-aware project stream hook and selector.
- [ ] Replace remaining Dashboard seed state and verify responsive axe coverage.
