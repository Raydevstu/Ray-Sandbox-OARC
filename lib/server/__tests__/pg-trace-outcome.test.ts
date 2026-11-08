import { describe, expect, it } from "vitest";
import { setTraceOutcome } from "../pg-lifecycle";

describe("trace outcome", () => {
  it("writes accepted outcome for a trace id", async () => {
    const seen: any[] = [];
    const pool: any = { async query(text: string, params: any[] = []) { seen.push({ text, params }); return { rows: [] }; } };
    await setTraceOutcome(pool, "t1", "bank1", "t1", "accepted");
    expect(seen.length).toBe(1);
    expect(seen[0].text).toMatch(/UPDATE decision_traces/);
    expect(seen[0].params).toEqual(["accepted", "t1", "bank1", "t1"]);
  });

  it("rejects invalid outcome", async () => {
    const pool: any = { async query() { return { rows: [] }; } };
    await expect(setTraceOutcome(pool, "t1", "bank1", "t1", "bogus" as any)).rejects.toThrow(/outcome/);
  });
});
