import assert from "node:assert/strict";
import { it as test } from "vitest";
import { buildMemoryLayers, packLayeredFacts } from "../layers";

test("builds deterministic summary layers with full detail preserved", () => {
  const layers = buildMemoryLayers("Alice shipped the vector search upgrade on March 4, 2026. It reduced latency for the team.");

  assert.match(layers.l0, /Alice shipped/);
  assert.match(layers.l1, /March 4, 2026/);
  assert.match(layers.l2, /reduced latency/);
});

test("packs layered facts without exceeding the token budget", () => {
  const facts = [
    { id: "a", abstract: "Alice shipped search", overview: "Alice shipped search on March 4", detail: "Alice shipped the vector search upgrade on March 4." },
    { id: "b", abstract: "Bob tested search", overview: "Bob tested search on March 5", detail: "Bob tested the vector search upgrade on March 5." },
  ];

  const result = packLayeredFacts(facts, 8);

  assert.ok(result.tokensUsed <= 8);
  assert.equal(result.layers.every((layer) => ["l0", "l1", "l2"].includes(layer.layer)), true);
});
