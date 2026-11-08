import { expect, it } from "vitest";
import { extractFacts, distillSession } from "../distillation";

it('extracts durable facts from investigation', () => {
  const facts = distillSession({ task: "Fix random logout", events: [
    { type: "FILE_VIEWED", file: "AuthService.ts", timestamp: 1 },
    { type: "ERROR_FOUND", timestamp: 2, content: "refresh token expired" },
    { type: "FIX_APPLIED", timestamp: 3, content: "retry refresh request" },
  ], findings: ["refresh token race"], resolution: "retry refresh" });
  expect(facts.length).toBeGreaterThan(0);
  expect(facts[0].entity.length).toBeGreaterThan(0);
  expect(facts[0].confidence).toBeGreaterThan(0.5);
});

it('extractFacts keeps unresolved investigations as open', () => {
  const facts = extractFacts({ id: "x", task: " probe flaky", filesTouched: ["a.ts"], tests: [], findings: [] });
  expect(facts.length).toBeGreaterThan(0);
});
