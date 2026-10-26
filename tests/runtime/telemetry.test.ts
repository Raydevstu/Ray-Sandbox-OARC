import { describe, expect, it } from "vitest";
import { appendBoundedPoint, appendBoundedSeries, createTelemetryStreamSnapshot, currentPoint, deriveTelemetryStreamState, ingestTelemetryEvent, pushBounded, recordRenderCost, setTelemetryStreamState, telemetryEventsFromSandboxEvent, telemetryTableRows, type OarcSeries } from "../../lib/runtime/telemetry";

const point = (timestamp: number, value: number) => ({ timestamp, value });
const series: OarcSeries = { id: "recall", label: "Recall", points: [point(1, 10), point(2, 20)], colorToken: "primary", lineStyle: "solid", enabled: true };

describe("bounded telemetry models", () => {
  it("keeps generic stream buffers bounded and immutable", () => {
    const source = [1, 2];
    expect(pushBounded(source, 3, 2)).toEqual([2, 3]);
    expect(source).toEqual([1, 2]);
  });
  it("keeps only the newest points without mutating the input", () => {
    const result = appendBoundedPoint(series.points, point(3, 30), 2);
    expect(result).toEqual([point(2, 20), point(3, 30)]);
    expect(series.points).toHaveLength(2);
  });

  it("updates one series immutably", () => {
    const result = appendBoundedSeries(series, point(3, 30), 2);
    expect(result.points).toEqual([point(2, 20), point(3, 30)]);
    expect(result).not.toBe(series);
  });

  it("selects the newest enabled point and produces table rows", () => {
    const disabled: OarcSeries = { ...series, id: "disabled", enabled: false, points: [point(4, 99)] };
    expect(currentPoint([series, disabled])).toEqual(point(2, 20));
    expect(telemetryTableRows([series])).toHaveLength(2);
  });

  it("records non-negative render cost without exposing library types", () => {
    expect(recordRenderCost(10, 13)).toEqual({ measuredAt: expect.any(Number), milliseconds: 3 });
  });

  it("ingests typed events only while live and keeps the stream bounded", () => {
    const initial = createTelemetryStreamSnapshot([series]);
    const first = ingestTelemetryEvent(initial, { seriesId: "recall", point: point(3, 30) }, 2);
    expect(first.series[0].points).toEqual([point(2, 20), point(3, 30)]);
    expect(first.lastEventAt).toBe(3);
    const paused = setTelemetryStreamState(first, "paused");
    expect(ingestTelemetryEvent(paused, { seriesId: "recall", point: point(4, 40) }, 2)).toBe(paused);
  });

  it("derives freshness without overriding operator pause or disconnect", () => {
    const initial = createTelemetryStreamSnapshot([series]);
    const live = ingestTelemetryEvent(initial, { seriesId: "recall", point: point(1000, 30) });
    expect(deriveTelemetryStreamState(live, 5000, 5000)).toBe("live");
    expect(deriveTelemetryStreamState(live, 6001, 5000)).toBe("stale");
    expect(deriveTelemetryStreamState(setTelemetryStreamState(live, "paused"), 5001, 1)).toBe("paused");
    expect(deriveTelemetryStreamState(setTelemetryStreamState(live, "disconnected"), 5001, 1)).toBe("disconnected");
  });

  it("maps a real sandbox event into bounded telemetry updates", () => {
    const events = telemetryEventsFromSandboxEvent({ id: "event-1", at: "2026-10-07T00:00:00.000Z", app: "memory", op: "recall", latencyMs: 187, tokens: 612 });
    expect(events.map((event) => event.seriesId)).toEqual(["recall", "recall-latency", "tokens"]);
    const initial = createTelemetryStreamSnapshot([
      { id: "recall", label: "Recall / sec", points: [], colorToken: "primary", lineStyle: "solid", enabled: true },
      { id: "recall-latency", label: "Recall latency", points: [], colorToken: "alert", lineStyle: "dashed", enabled: true },
      { id: "tokens", label: "Tokens", points: [], colorToken: "secondary", lineStyle: "dotted", enabled: true },
    ]);
    const updated = events.reduce((snapshot, event) => ingestTelemetryEvent(snapshot, event), initial);
    expect(updated.series.every((item) => item.points)).toBe(true);
    expect(updated.lastEventAt).toBe(Date.parse("2026-10-07T00:00:00.000Z"));
  });
});
