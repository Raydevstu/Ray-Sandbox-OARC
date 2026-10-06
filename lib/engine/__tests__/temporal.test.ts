import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  classifyTemporalIntent,
  deriveTemporalMetadata,
  resolveFactHistory,
} from "../temporal";

describe("temporal memory semantics", () => {
  test("classifies an explicit event with day precision", () => {
    const metadata = deriveTemporalMetadata("Alice shipped the update on March 4, 2026.");

    assert.equal(metadata.type, "event");
    assert.equal(metadata.status, "completed");
    assert.equal(metadata.precision, "day");
  });

  test("classifies current-state questions separately from historical questions", () => {
    assert.equal(classifyTemporalIntent("Where does Alice work now?"), "current");
    assert.equal(classifyTemporalIntent("What did Alice used to prefer?"), "historical");
  });

  test("resolves current and historical fact sets without deleting evidence", () => {
    const facts = [
      { id: "old", supersedes: null, mentionedAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", supersedes: "old", mentionedAt: "2026-02-01T00:00:00.000Z" },
    ];

    assert.deepEqual(resolveFactHistory(facts, "current").map((fact) => fact.id), ["new"]);
    assert.deepEqual(resolveFactHistory(facts, "historical").map((fact) => fact.id), ["old"]);
    assert.deepEqual(resolveFactHistory(facts, "all").map((fact) => fact.id), ["new", "old"]);
  });
});
