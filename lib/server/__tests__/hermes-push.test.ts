import { describe, expect, it } from "vitest";
import {
  parsePushBody,
  bankIdForCwd,
  findBankForCwd,
  parseTranscriptText,
  type BankCwdRow,
} from "../hermes-push";

const ROWS: BankCwdRow[] = [
  { bankId: "demoapp", cwdKey: "d:/projects/demoapp" },
  { bankId: "other", cwdKey: "d:/projects/other" },
];

describe("hermes push", () => {
  it("parses a valid push body", () => {
    const out = parsePushBody({
      cwd: "D:\\Projects\\DemoApp",
      sessionId: "sess-1",
      messages: [
        { role: "user", content: "deploy it", timestamp: 100 },
        { role: "assistant", content: "deployed", timestamp: 101 },
      ],
    });
    expect(out.sessionId).toBe("sess-1");
    expect(out.messages).toHaveLength(2);
  });

  it("rejects missing cwd or empty messages", () => {
    expect(() => parsePushBody({ cwd: "", sessionId: "x", messages: [{ role: "user", content: "hi", timestamp: 1 }] })).toThrow(/cwd/);
    expect(() => parsePushBody({ cwd: "D:\\P", sessionId: "x", messages: [] })).toThrow(/messages/);
    expect(() => parsePushBody(null)).toThrow();
  });

  it("derives a bank id from the cwd basename", () => {
    expect(bankIdForCwd("D:\\Projects\\DemoApp")).toBe("demoapp");
    expect(bankIdForCwd("D:/Projects/OBA Ultimate/")).toBe("oba-ultimate");
  });

  it("matches a bank by normalized cwd", () => {
    expect(findBankForCwd(ROWS, "D:\\Projects\\DemoApp")).toBe("demoapp");
    expect(findBankForCwd(ROWS, "D:/projects/OTHER")).toBe("other");
    expect(findBankForCwd(ROWS, "D:\\Nowhere\\Else")).toBeNull();
  });

  it("splits pasted transcripts on speaker labels", () => {
    const msgs = parseTranscriptText("User: deploy it\nAssistant: deployed\nthanks");
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[1].content).toBe("deployed\nthanks");
  });

  it("treats unlabeled text as one user message", () => {
    const msgs = parseTranscriptText("just some notes about the router");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
  });
});
