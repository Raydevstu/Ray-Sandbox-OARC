import { describe, expect, it } from "vitest";
import { syncBankFromSessions } from "../hermes-sync";
import type { HermesMessage, HermesSession } from "../hermes-sessions";

const SESSIONS: HermesSession[] = [
  { id: "s1", cwd: "D:\\Projects\\OBA Ultimate", lastActivity: 10, messageCount: 2 },
  { id: "s2", cwd: "C:\\Users\\kafsh", lastActivity: 20, messageCount: 1 },
];

const MESSAGES: HermesMessage[] = [
  { sessionId: "s1", role: "user", content: "deploy the router", timestamp: 5 },
  { sessionId: "s1", role: "assistant", content: "router deployed", timestamp: 6 },
  { sessionId: "s2", role: "user", content: "unrelated", timestamp: 7 },
];

describe("hermes sync", () => {
  it("imports only sessions matching the bank cwd", async () => {
    const saved: string[] = [];
    const out = await syncBankFromSessions({
      bankId: "oba",
      bankCwdKey: "d:/projects/oba ultimate",
      sessions: SESSIONS,
      readMessages: (id) => MESSAGES.filter((m) => m.sessionId === id),
      getCursor: () => 0,
      setCursor: () => {},
      saveFacts: async (facts) => { saved.push(...facts.map((f) => f.content)); },
    });
    expect(out.sessionsMatched).toBe(1);
    expect(out.messagesImported).toBe(2);
    expect(saved.join("\n")).toMatch(/deploy the router/);
    expect(saved.join("\n")).not.toMatch(/unrelated/);
  });

  it("skips messages at or below the cursor", async () => {
    const out = await syncBankFromSessions({
      bankId: "oba",
      bankCwdKey: "d:/projects/oba ultimate",
      sessions: SESSIONS,
      readMessages: (id) => MESSAGES.filter((m) => m.sessionId === id),
      getCursor: () => 5,
      setCursor: () => {},
      saveFacts: async () => {},
    });
    expect(out.messagesImported).toBe(1);
  });
});
