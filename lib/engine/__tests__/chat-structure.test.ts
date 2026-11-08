import { describe, expect, it } from "vitest";
import { classifyOutcome, structureTranscript } from "../chat-structure";
import type { ChatMessage } from "../chat-structure";

const M = (role: string, content: string, timestamp: number): ChatMessage => ({ role, content, timestamp });

describe("chat structure", () => {
  it("classifies decisions", () => {
    expect(classifyOutcome("We decided to go with Postgres instead of SQLite")).toBe("decision");
  });
  it("classifies implementations", () => {
    expect(classifyOutcome("Implementing the watcher loop with a 60s setInterval")).toBe("implementation");
  });
  it("classifies progress", () => {
    expect(classifyOutcome("Progress so far: the endpoint works, currently wiring the UI")).toBe("progress");
  });
  it("classifies failures", () => {
    expect(classifyOutcome("The build failed with a crash on startup, rolling back")).toBe("failure");
  });
  it("classifies successes", () => {
    expect(classifyOutcome("Shipped the fix, all tests pass, deployed to prod")).toBe("success");
  });
  it("classifies goals", () => {
    expect(classifyOutcome("Our goal for this sprint is zero manual config for every user")).toBe("goal");
  });
  it("falls back to note", () => {
    expect(classifyOutcome("hello, just checking in")).toBe("note");
  });

  it("chunks a user+assistant exchange into one structured fact", () => {
    const facts = structureTranscript("s1", [M("user", "We decided to go with Postgres", 1), M("assistant", "Postgres wired up", 2)], "demoapp");
    expect(facts).toHaveLength(1);
    expect(facts[0].category).toBe("decision");
    expect(facts[0].provenance?.turnId).toBe("s1");
    expect(facts[0].content).toMatch(/Postgres/);
  });

  it("splits separate exchanges and falls back to bank entity", () => {
    const facts = structureTranscript(
      "s1",
      [M("user", "our goal is zero manual config", 1), M("assistant", "noted", 2), M("user", "the build failed on startup", 3)],
      "demoapp"
    );
    expect(facts).toHaveLength(2);
    expect(facts.map((f) => f.category)).toEqual(["goal", "failure"]);
  });

  it("maps notes to workflow with valid importance", () => {
    const facts = structureTranscript("s1", [M("user", "hello, just checking in", 1)], "demoapp");
    expect(facts[0].category).toBe("workflow");
    expect(facts[0].importance).toBeGreaterThanOrEqual(0);
    expect(facts[0].importance).toBeLessThanOrEqual(100);
  });
});
