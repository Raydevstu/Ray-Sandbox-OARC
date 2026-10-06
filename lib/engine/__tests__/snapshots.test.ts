import test from "node:test";
import assert from "node:assert/strict";
import { createSnapshot, diffSnapshots, rebuildIndexes, type SnapshotData } from "../snapshots";

const data = (text: string): SnapshotData => ({ banks: [], facts: [{ id: "f1", text, entities: ["Alice"], tokens: 2 } as never], links: [], observations: [], opinions: [], evalRuns: [] });
test("snapshot diff identifies added, removed, and changed facts", () => { const result = diffSnapshots(data("old"), { ...data("new"), facts: [...data("new").facts, { id: "f2", text: "added" } as never] }); assert.deepEqual(result.changedFacts, ["f1"]); assert.deepEqual(result.addedFacts, ["f2"]); assert.deepEqual(result.removedFacts, []); });
test("snapshots are named and rebuild reports deterministic index inputs", () => { const snapshot = createSnapshot("baseline", data("fact")); assert.equal(snapshot.name, "baseline"); assert.equal(rebuildIndexes(snapshot.data).entityCount, 1); assert.ok(snapshot.checksum); });
