import { describe, expect, it } from "vitest";
import {
  normalizeCwd,
  cwdToBankKey,
  buildSessionTranscript,
  newMessagesSince,
  type HermesMessage,
  type HermesSession,
} from "../hermes-sessions";

const SESSIONS: HermesSession[] = [
  { id: "a", cwd: "D:\\Projects\\OBA Ultimate", lastActivity: 100, messageCount: 5 },
  { id: "b", cwd: "D:/Projects/OBA Ultimate/", lastActivity: 200, messageCount: 3 },
  { id: "c", cwd: "C:\\Users\\kafsh", lastActivity: 300, messageCount: 9 },
];

describe("hermes sessions", () => {
  it("normalizes windows and posix cwds to one key", () => {
    expect(normalizeCwd("D:\\Projects\\OBA Ultimate")).toBe("d:/projects/oba ultimate");
    expect(normalizeCwd("D:/Projects/OBA Ultimate/")).toBe("d:/projects/oba ultimate");
  });

  it("maps bank watch paths to the same key space", () => {
    expect(cwdToBankKey("/projects", "oba-ultimate")).toBe("oba-ultimate");
    expect(cwdToBankKey("/projects", "/projects/oba-ultimate")).toBe("oba-ultimate");
  });

  it("builds a transcript from role/content rows", () => {
    const msgs: HermesMessage[] = [
      { sessionId: "a", role: "user", content: "hello", timestamp: 1 },
      { sessionId: "a", role: "assistant", content: "hi there", timestamp: 2 },
    ];
    const t = buildSessionTranscript("a", msgs);
    expect(t).toMatch(/User: hello/);
    expect(t).toMatch(/Assistant: hi there/);
  });

  it("only returns messages newer than the cursor", () => {
    const msgs: HermesMessage[] = [
      { sessionId: "a", role: "user", content: "old", timestamp: 1 },
      { sessionId: "a", role: "user", content: "new", timestamp: 5 },
    ];
    expect(newMessagesSince(msgs, 3).map((m) => m.content)).toEqual(["new"]);
  });
});
