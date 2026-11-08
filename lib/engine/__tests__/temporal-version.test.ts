import { describe, expect, it } from "vitest";
import { preferLatestVersion } from "../temporal-version";
import type { MemoryFact } from "@/lib/types";

describe("temporal version preference", () => {
  it("prefers v15 over v14 when both present", () => {
    const facts = [
      { id: "f1", text: "PostgreSQL 14", mentionedAt: "2024-01-01", supersedes: null, entities: ["PostgreSQL"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
      { id: "f2", text: "PostgreSQL 15", mentionedAt: "2024-02-01", supersedes: "f1", entities: ["PostgreSQL"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
    ] as unknown as MemoryFact[];
    const result = preferLatestVersion(facts);
    expect(result[0].text).toContain("15");
  });

  it("returns all when no version history", () => {
    const facts = [
      { id: "f1", text: "Alice likes tea", mentionedAt: "2024-01-01", entities: ["Alice"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
      { id: "f2", text: "Bob likes coffee", mentionedAt: "2024-02-01", entities: ["Bob"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
    ] as unknown as MemoryFact[];
    const result = preferLatestVersion(facts);
    expect(result).toHaveLength(2);
  });

  it("boosts recency for latest version", () => {
    const facts = [
      { id: "f1", text: "PostgreSQL 14", mentionedAt: "2024-01-01", supersedes: null, entities: ["PostgreSQL"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
      { id: "f2", text: "PostgreSQL 15", mentionedAt: "2024-02-01", supersedes: "f1", entities: ["PostgreSQL"], tags: [], bankId: "b1", network: "world", confidence: 0.9, scopes: {} },
    ] as unknown as MemoryFact[];
    const result = preferLatestVersion(facts);
    // f2 should have higher score than f1
    expect(result.find(f => f.id === "f2")?.recencyBoost).toBeGreaterThan(result.find(f => f.id === "f1")?.recencyBoost ?? 0);
  });
});
