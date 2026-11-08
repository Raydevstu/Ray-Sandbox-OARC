import { expect, it } from "vitest";
import { buildInvestigation } from "../investigations";

it('groups session events into investigation with files and task', () => {
  const inv = buildInvestigation({ task: "Investigate Login Timeout", events: [
    { type: "FILE_VIEWED", file: "AuthService.ts", timestamp: 1 },
    { type: "FILE_MODIFIED", file: "AuthService.ts", timestamp: 2 },
    { type: "TEST_RUN", file: "auth.spec.ts", timestamp: 3 },
  ]});
  expect(inv.task).toBe("Investigate Login Timeout");
  expect(inv.filesTouched).toContain("AuthService.ts");
  expect(inv.tests).toContain("auth.spec.ts");
});
