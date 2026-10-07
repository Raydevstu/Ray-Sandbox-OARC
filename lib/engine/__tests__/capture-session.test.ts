import { it as test } from "vitest";
import assert from "node:assert/strict";
import { stripMemoryContext, wrapMemoryContext } from "../capture";
import { captureMessage, DEFAULT_SESSION_BUFFER, drainBuffer, shouldAutoCommit } from "../session-buffer";

test("capture strips recalled context and reports bounded diagnostics", () => {
  const result = stripMemoryContext(`answer <memory-context>old fact [id]</memory-context> new fact`);
  assert.equal(result.text, "answer  new fact");
  assert.equal(result.diagnostics.strippedRecallBlocks, 1);
  assert.match(wrapMemoryContext("cited fact"), /<memory-context>/);
});

test("session buffer is immutable and threshold commits older messages", () => {
  const configured = { ...DEFAULT_SESSION_BUFFER, policy: "threshold" as const, maxPendingMessages: 2 };
  const first = captureMessage(configured, "user", "first message");
  const second = captureMessage(first, "assistant", "second message");
  assert.equal(configured.messages.length, 0);
  assert.equal(shouldAutoCommit(second), true);
  const drained = drainBuffer(second);
  assert.match(drained.content, /first message/);
  assert.equal(drained.remainder.messages.length, 0);
});
