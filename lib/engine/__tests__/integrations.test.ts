import { it as test } from "vitest";
import assert from "node:assert/strict";
import type { SandboxEvent } from "@/lib/types";
import { createIntegrationEvent, normalizeSandboxEvent } from "../integration-events";
import { recordFeedback } from "../feedback";
import { enqueueEvent, replayQueue } from "../offline-queue";
import { buildFilesystemProjection } from "../projection";
import { buildAdapterExamples } from "@/lib/integrations/adapters";

const source: SandboxEvent = { id: "evt-1", at: "2026-10-06T10:00:00.000Z", app: "memory", op: "retain", message: "saved", tokens: 3 };

test("normalizes legacy events into a stable canonical envelope", () => {
  const result = normalizeSandboxEvent(source);
  assert.equal(result.version, 1);
  assert.equal(result.type, "memory.retained");
  assert.equal(result.id, "evt-1");
  assert.deepEqual(result.provenance, { app: "memory", source: "sandbox-event" });
});

test("feedback records target facts and preserves prior records", () => {
  const first = recordFeedback({ factId: "f1", outcome: "up", note: "useful" }, []);
  const second = recordFeedback({ factId: "f1", outcome: "correction", note: "updated" }, first);
  assert.equal(first.length, 1);
  assert.equal(second.length, 2);
  assert.equal(first[0].outcome, "up");
  assert.equal(second[1].factId, "f1");
});

test("offline replay is FIFO and idempotent", () => {
  const a = createIntegrationEvent({ type: "memory.retained", payload: { factId: "f1" }, at: "2026-01-01T00:00:00.000Z" });
  const b = createIntegrationEvent({ type: "memory.retained", payload: { factId: "f2" }, at: "2026-01-01T00:00:01.000Z" });
  const queue = enqueueEvent(enqueueEvent([], a), b);
  const first = replayQueue(queue, { failEventIds: [] });
  const second = replayQueue(first.queue, { failEventIds: [] });
  assert.deepEqual(first.delivered.map((event) => event.id), [a.id, b.id]);
  assert.equal(second.delivered.length, 0);
  assert.equal(second.queue.length, 0);
});

test("filesystem projection sanitizes paths and cites source facts", () => {
  const projection = buildFilesystemProjection({ bankId: "bank-1", bankName: "Atlas / Demo", facts: [{ id: "f1", text: "Alice / prefers tea", entities: ["Alice"], tags: ["preference"] }] });
  assert.ok(projection.files.some((file) => file.path === "memories/f1.md"));
  assert.ok(projection.files.some((file) => file.path.startsWith("entities/alice")));
  assert.ok(projection.manifest.includes("f1"));
});

test("adapter examples share event identity and provenance", () => {
  const event = createIntegrationEvent({ type: "memory.retained", payload: { factId: "f1" }, at: "2026-01-01T00:00:00.000Z" });
  const examples = buildAdapterExamples(event);
  assert.deepEqual(examples.map((example) => example.name), ["n8n", "Zapier", "MCP"]);
  for (const example of examples) assert.equal(example.payload.event_id, event.id);
});
