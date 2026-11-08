import { describe, expect, it } from "vitest";
import { applyEntityScoping } from "../recall";

describe("entity scoping isolation", () => {
  const facts = [
    { id: "f1", text: "Alice at Acme", scopes: { userId: "alice", agentId: "atlas" }, bankId: "b1", network: "world", confidence: 0.9, entities: [], tags: [], mentionedAt: "2024-01-01" },
    { id: "f2", text: "Bob at Beta", scopes: { userId: "bob", agentId: "atlas" }, bankId: "b1", network: "world", confidence: 0.9, entities: [], tags: [], mentionedAt: "2024-01-01" },
  ] as any[];

  it("filters to alice only when userId=alice", () => {
    const result = applyEntityScoping(facts, { userId: "alice" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("f1");
  });

  it("returns all when no userId set", () => {
    const result = applyEntityScoping(facts, {});
    expect(result).toHaveLength(2);
  });

  it("filters by both userId and agentId", () => {
    const result = applyEntityScoping(facts, { userId: "alice", agentId: "atlas" });
    expect(result).toHaveLength(1);
  });
});
