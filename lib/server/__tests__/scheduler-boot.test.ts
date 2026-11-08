import { describe, expect, it } from "vitest";
import { shouldBootScheduler, watcherKey } from "../scheduler-boot";

describe("scheduler boot", () => {
  it("boots only when APEX_NIGHTLY is true", () => {
    expect(shouldBootScheduler({ APEX_NIGHTLY: "true" })).toBe(true);
    expect(shouldBootScheduler({ APEX_NIGHTLY: "false" })).toBe(false);
    expect(shouldBootScheduler({})).toBe(false);
  });

  it("watcher key is stable per bank", () => {
    expect(watcherKey("t", "b")).toBe("t/b");
  });
});
