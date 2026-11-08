import { describe, expect, it, vi } from "vitest";
import { scheduleNightly, runConsolidationOnce } from "../scheduler";

describe("nightly scheduler", () => {
  it("scheduleNightly fires the job on a timer", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const stop = scheduleNightly(fn, 1000);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("runConsolidationOnce supersedes decays and saves", async () => {
    const queries: string[] = [];
    const pool: any = {
      async query(text: string, params: any[] = []) {
        queries.push(text);
        if (/FROM facts/i.test(text)) {
          return { rows: [
            { entity: "Auth", category: "workflow", content: "old", confidence: 0.5, importance: 40, occurrences: 1, provenance: null },
          ] };
        }
        return { rows: [] };
      },
    };
    const out = await runConsolidationOnce(pool, "t", "b");
    expect(out.before).toBe(1);
    expect(out.after).toBe(1);
    expect(queries.some((q) => /INSERT INTO facts/i.test(q))).toBe(true);
  });
});
