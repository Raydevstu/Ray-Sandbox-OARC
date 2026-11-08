import { describe, expect, it } from "vitest";
import { scoreSkills, applySkillWeights } from "../skill-score";
import type { DecisionTrace } from "../decision-trace";

function trace(why: string, outcome: "accepted" | "edited" | "reverted"): DecisionTrace {
  return {
    id: `t-${why}-${outcome}-${Math.random()}`,
    queryHash: "q", task: "x", model: "local", tokens: 1, createdAt: 1, outcome,
    items: [{ entity: "E", score: 1, why, contentHash: "h", contentLength: 1 }],
  };
}

describe("skill scoring", () => {
  it("scores per-why acceptance rates", () => {
    const traces = [
      ...Array.from({ length: 6 }, () => trace("keyword+2", "accepted")),
      ...Array.from({ length: 4 }, () => trace("keyword+2", "edited")),
      ...Array.from({ length: 5 }, () => trace("semantic", "reverted")),
    ];
    const scores = scoreSkills(traces);
    expect(scores["keyword+2"].acceptance).toBeCloseTo(0.6, 2);
    expect(scores["keyword+2"].samples).toBe(10);
    expect(scores["semantic"].acceptance).toBe(0);
  });

  it("promotes winners above threshold with enough samples", () => {
    const weights = applySkillWeights(
      { "keyword+2": { acceptance: 0.8, samples: 10 }, "semantic": { acceptance: 0.2, samples: 10 } },
      {}
    );
    expect(weights["keyword+2"]).toBeGreaterThan(1);
    expect(weights["semantic"]).toBeLessThan(1);
  });

  it("leaves low-sample tags at neutral", () => {
    const weights = applySkillWeights({ "graph": { acceptance: 1, samples: 2 } }, {});
    expect(weights["graph"] ?? 1).toBe(1);
  });
});
