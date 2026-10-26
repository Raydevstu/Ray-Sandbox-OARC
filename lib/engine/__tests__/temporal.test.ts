import { describe, expect, it } from "vitest";
import {
  classifyTemporalIntent,
  deriveTemporalMetadata,
  resolveFactHistory,
} from "../temporal";

describe("temporal memory semantics", () => {
  it("classifies an explicit event with day precision", () => {
    const metadata = deriveTemporalMetadata("Alice shipped the update on March 4, 2026.");

    expect(metadata.type).toBe("event");
    expect(metadata.status).toBe("completed");
    expect(metadata.precision).toBe("day");
  });

  it("classifies current-state questions separately from historical questions", () => {
    expect(classifyTemporalIntent("Where does Alice work now?")).toBe("current");
    expect(classifyTemporalIntent("What did Alice used to prefer?")).toBe("historical");
  });

  it("resolves current and historical fact sets without deleting evidence", () => {
    const facts = [
      { id: "old", supersedes: null, mentionedAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", supersedes: "old", mentionedAt: "2026-02-01T00:00:00.000Z" },
    ];

    expect(resolveFactHistory(facts, "current").map((fact) => fact.id)).toEqual(["new"]);
    expect(resolveFactHistory(facts, "historical").map((fact) => fact.id)).toEqual(["old"]);
    expect(resolveFactHistory(facts, "all").map((fact) => fact.id)).toEqual(["new", "old"]);
  });
});
