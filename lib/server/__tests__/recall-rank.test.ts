import { describe, expect, it } from "vitest";
import { rankBankFacts } from "../recall-rank";
import type { DistilledFact } from "../../engine/distillation";

const F = (entity: string, category: DistilledFact["category"], content: string): DistilledFact => ({
  entity, category, content, confidence: 0.7, importance: 60, occurrences: 1,
});

describe("recall rank", () => {
  it("returns empty for no rows", () => {
    expect(rankBankFacts("deploy", [], 5)).toEqual([]);
  });

  it("ranks the deployment decision above an unrelated note", () => {
    const rows = [
      F("general", "workflow", "hello, just checking in about lunch"),
      F("router", "decision", "We decided to deploy the router with retries"),
    ];
    const out = rankBankFacts("deploy the router decision", rows, 5);
    expect(out[0].category).toBe("decision");
  });

  it("respects the limit", () => {
    const rows = [F("a", "goal", "goal one"), F("b", "goal", "goal two"), F("c", "goal", "goal three")];
    expect(rankBankFacts("goal", rows, 2)).toHaveLength(2);
  });
});
