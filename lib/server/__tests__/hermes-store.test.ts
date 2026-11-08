import { describe, expect, it } from "vitest";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { readHermesSessions, readSessionMessages, HERMES_DB_ENV } from "../hermes-store";

const PROBE = "./.data/probe/state.db";

function ensureProbe() {
  if (existsSync(PROBE)) return true;
  try {
    mkdirSync("./.data/probe", { recursive: true });
    copyFileSync("/tmp/probe-state.db", PROBE);
    return true;
  } catch {
    return false;
  }
}

describe("hermes store reader", () => {
  it("env var names the db path", () => {
    expect(HERMES_DB_ENV).toBe("HERMES_STATE_DB");
  });

  it("reads sessions from a state.db copy", () => {
    if (!ensureProbe()) return;
    const sessions = readHermesSessions(PROBE);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty("id");
    expect(sessions[0]).toHaveProperty("cwd");
  });

  it("reads messages for a session", () => {
    if (!ensureProbe()) return;
    const sessions = readHermesSessions(PROBE);
    const withMsgs = sessions.filter((s) => s.messageCount > 0);
    expect(withMsgs.length).toBeGreaterThan(0);
    const msgs = readSessionMessages(PROBE, withMsgs[0].id, 0, 5);
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0]).toHaveProperty("role");
    expect(msgs[0]).toHaveProperty("content");
  });

  it("returns empty for missing db", () => {
    expect(readHermesSessions("/tmp/does-not-exist.db")).toEqual([]);
    expect(readSessionMessages("/tmp/does-not-exist.db", "x", 0, 5)).toEqual([]);
  });
});
