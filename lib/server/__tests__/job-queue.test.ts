import { describe, expect, it } from "vitest";
import { enqueue, drain, statusOf } from "../job-queue";

describe("job queue", () => {
  it("drains FIFO and records success", async () => {
    const order: string[] = [];
    const q = enqueue("t", "b", "workflow", { x: 1 });
    enqueue("t", "b", "replay", { y: 2 });
    const done = await drain(
      async (..._a: any[]) => ({ rows: [] }),
      async (kind) => { order.push(kind); return { ok: true }; }
    );
    expect(order).toEqual(["workflow", "replay"]);
    expect(done.length).toBe(2);
    void q;
  });

  it("records failure with retry count", async () => {
    enqueue("t", "b", "evaluate", {});
    const done = await drain(
      async (..._a: any[]) => ({ rows: [] }),
      async () => { throw new Error("boom"); }
    );
    expect(done[0].status).toBe("failed");
    expect(done[0].attempts).toBe(1);
  });

  it("statusOf finds a job by id", () => {
    const j = enqueue("t", "b", "trace", {});
    expect(statusOf(j.id)?.kind).toBe("trace");
  });
});
