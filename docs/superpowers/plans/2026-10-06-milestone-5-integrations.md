# Milestone 5 Integration Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a deterministic, browser-safe integration surface for filesystem projections, outcome feedback, offline queue simulation, canonical events, and n8n/Zapier/MCP adapter examples.

**Architecture:** Keep all new behavior pure and local-first. A versioned canonical event envelope becomes the shared boundary; feedback and queue operations produce immutable records, projections produce downloadable file manifests, and adapters serialize the same event shape without network calls. Zustand stores the records with defensive migration defaults, while the existing Integrations page exposes simulation and inspection controls.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, existing deterministic sandbox engines and UI components.

**Spec:** User-approved Milestone 5 design in the task conversation.

## Global Constraints

- Keep the implementation focused and below the project’s 800-line change guidance.
- No external network requests; adapters and queue delivery are simulations.
- Preserve existing localStorage state through defensive migration defaults.
- Use immutable state transitions and bounded history/queue sizes.
- Filesystem projection means downloadable browser-generated files, not direct server filesystem writes.
- All adapter examples must carry provenance and event identifiers.

## Review Focus

- Events from legacy `SandboxEvent` values must normalize deterministically and retain their original operation semantics.
- Feedback for missing or deleted memory IDs must fail clearly without creating an orphan record.
- Queue replay must preserve insertion order, be idempotent, and expose failures instead of silently dropping entries.
- Projection paths must be sanitized and deterministic for unusual fact text, tags, and entities.
- Adapter payloads must not contain secrets or claim that simulated delivery reached an external service.

### Task 1: Canonical events and outcome feedback

**Files:**
- Create: `lib/engine/integration-events.ts`
- Create: `lib/engine/feedback.ts`
- Modify: `lib/types.ts`
- Test: `lib/engine/__tests__/integrations.test.ts`

**Interfaces:**
- `createIntegrationEvent(input): CanonicalIntegrationEvent`
- `normalizeSandboxEvent(event): CanonicalIntegrationEvent`
- `recordFeedback(input, existing): FeedbackRecord[]`

- [ ] Write failing tests for stable event IDs/types, legacy event normalization, positive/negative/correction feedback, and invalid targets.
- [ ] Run the focused test and confirm it fails because the new interfaces do not exist.
- [ ] Implement the versioned envelope and immutable feedback record helpers.
- [ ] Run the focused test and the existing engine suite.
- [ ] Commit the focused core slice.

### Task 2: Offline queue simulation

**Files:**
- Create: `lib/engine/offline-queue.ts`
- Modify: `lib/types.ts`
- Modify: `lib/store.ts`
- Test: `lib/engine/__tests__/integrations.test.ts`

**Interfaces:**
- `enqueueEvent(queue, event): OfflineQueueEntry[]`
- `replayQueue(queue, policy): { queue: OfflineQueueEntry[]; delivered: CanonicalIntegrationEvent[]; errors: string[] }`

- [ ] Add failing tests for bounded enqueue, FIFO replay, idempotent replay, and explicit simulated failures.
- [ ] Implement immutable queue transitions and store actions with migration defaults.
- [ ] Run focused and full engine tests.
- [ ] Commit the queue slice.

### Task 3: Filesystem projection

**Files:**
- Create: `lib/engine/projection.ts`
- Modify: `lib/store.ts`
- Test: `lib/engine/__tests__/integrations.test.ts`

**Interfaces:**
- `buildFilesystemProjection(input): FilesystemProjection`

- [ ] Add failing tests for deterministic directories, sanitized filenames, manifest provenance, and empty collections.
- [ ] Implement a bounded projection containing file paths and UTF-8 contents suitable for browser download.
- [ ] Add a store action that projects the active bank without mutating memory.
- [ ] Run tests and commit the projection slice.

### Task 4: Adapter examples and Integrations UX

**Files:**
- Create: `lib/integrations/adapters.ts`
- Modify: `app/sandbox/integrations/page.tsx`
- Test: `lib/engine/__tests__/integrations.test.ts`

**Interfaces:**
- `buildAdapterExamples(event): AdapterExample[]`

- [ ] Add failing tests for n8n, Zapier, and MCP examples sharing the same event ID and provenance.
- [ ] Implement JSON payload/configuration examples with simulated-delivery labels.
- [ ] Add UI controls for canonical event inspection, feedback, queue replay, projection preview/download, and adapter examples.
- [ ] Run typecheck, lint, build, engine tests, and an HTTP smoke test for `/sandbox/integrations`.
- [ ] Review the diff for scope and commit the complete Milestone 5 slice.

