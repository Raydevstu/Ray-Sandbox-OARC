import assert from "node:assert/strict";
import { it as test } from "vitest";
import { buildRecallDigest } from "../digest";

test("builds cited deterministic bullets and abstains on no relevant memories", () => {
  const digest = buildRecallDigest("Alice", [
    { fact: { id: "a", text: "Alice works at Google." }, finalScore: 0.9, tokens: 5 },
    { fact: { id: "b", text: "Alice works at Google." }, finalScore: 0.8, tokens: 5 },
  ]);

  assert.equal(digest.suppressed, false);
  assert.equal(digest.bullets.length, 1);
  assert.deepEqual(digest.bullets[0].factIds, ["a", "b"]);
});

test("suppresses a digest when every candidate is below the relevance threshold", () => {
  const digest = buildRecallDigest("unrelated", [{ fact: { id: "a", text: "Alice works at Google." }, finalScore: 0.05, tokens: 5 }]);

  assert.equal(digest.suppressed, true);
  assert.deepEqual(digest.bullets, []);
});
