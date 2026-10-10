"use client";

import { Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, type Series } from "@/components/charts";
import { createTelemetryStreamSnapshot, currentPoint, deriveTelemetryStreamState, ingestTelemetryEvent, recordRenderCost, telemetryEventsFromSandboxEvent, telemetryTableRows, zoomSeries, type OarcSeries, type RenderCostSample, type SandboxTelemetryEvent, type TelemetryConnection } from "@/lib/runtime/telemetry";

const colorTokens: Record<OarcSeries["colorToken"], string> = {
  primary: "var(--chart-primary)",
  secondary: "var(--chart-secondary)",
  tertiary: "var(--chart-tertiary)",
  alert: "var(--chart-alert)",
  critical: "var(--chart-critical)",
};

const lineStyles: Record<OarcSeries["lineStyle"], boolean> = { solid: false, dashed: true, dotted: true };

export function LiveObservabilityChart({
  title,
  description,
  series,
  events = [],
  connection = "live",
  onRenderCost,
}: Readonly<{
  title: string;
  description: string;
  series: readonly OarcSeries[];
  events?: readonly SandboxTelemetryEvent[];
  connection?: TelemetryConnection;
  onRenderCost?: (sample: RenderCostSample) => void;
}>) {
  const [paused, setPaused] = useState(false);
  const [windowSize, setWindowSize] = useState(30);
  const [showTable, setShowTable] = useState(false);
  const [stream, setStream] = useState(() => createTelemetryStreamSnapshot(series));
  const seenEvents = useRef(new Set<string>());
  const [renderStartedAt] = useState(() => performance.now());
  const [hidden, setHidden] = useState(false);
  const isPaused = paused || hidden;
  const visibleSeries = useMemo(() => stream.series.map((item) => zoomSeries(item, windowSize)), [stream.series, windowSize]);
  const chartSeries: Series[] = visibleSeries.map((item) => ({ name: item.label, color: colorTokens[item.colorToken], data: item.points.map((point) => point.value), dashed: lineStyles[item.lineStyle] }));
  const labels = visibleSeries[0]?.points.map((point) => new Date(point.timestamp).toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" })) ?? [];
  const latest = currentPoint(visibleSeries);
  const tableRows = telemetryTableRows(visibleSeries);
  const derivedState = deriveTelemetryStreamState({ ...stream, state: isPaused ? "paused" : stream.state }, Date.now());
  const statusLabel = connection === "live" ? (isPaused ? (hidden ? "Paused · tab hidden" : "Paused") : derivedState === "stale" ? "Stale" : "Live") : connection === "stale" ? "Stale" : "Disconnected";

  useEffect(() => {
    setStream((current) => {
      let next = current;
      for (const event of [...events].reverse()) {
        if (seenEvents.current.has(event.id)) continue;
        const updated = telemetryEventsFromSandboxEvent(event).reduce((snapshot, telemetryEvent) => ingestTelemetryEvent(snapshot, telemetryEvent), next);
        if (updated !== next) seenEvents.current.add(event.id);
        next = updated;
      }
      return next;
    });
  }, [events, isPaused]);

  useEffect(() => {
    onRenderCost?.(recordRenderCost(renderStartedAt));
  }, [onRenderCost, renderStartedAt, visibleSeries]);

  useEffect(() => {
    const handleVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return (
    <section className="oarc-live-chart" aria-label={title}>
      <div className="oarc-live-chart-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={`oarc-live-chart-status oarc-live-chart-status-${connection}`} role="status">{statusLabel}</span>
      </div>
      <div className="oarc-live-chart-controls" aria-label={`${title} controls`}>
        <button type="button" onClick={() => setPaused((value) => !value)} aria-pressed={isPaused} disabled={hidden} title={hidden ? "Streaming pauses while this tab is hidden" : paused ? "Resume stream" : "Pause stream"}>
          {isPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />} {isPaused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => setWindowSize((value) => Math.min(120, value + 15))} disabled={windowSize >= 120} title="Show more points"><ZoomOut size={14} aria-hidden="true" /> Zoom out</button>
        <button type="button" onClick={() => setWindowSize((value) => Math.max(5, value - 15))} disabled={windowSize <= 5} title="Show fewer points"><ZoomIn size={14} aria-hidden="true" /> Zoom in</button>
        <button type="button" onClick={() => setWindowSize(30)} disabled={windowSize === 30} title="Reset chart window"><RotateCcw size={14} aria-hidden="true" /> Reset</button>
        <button type="button" onClick={() => setShowTable((value) => !value)} aria-pressed={showTable}>{showTable ? "Chart" : "Table"}</button>
      </div>
      <p className="oarc-live-chart-summary" aria-live="polite">Current value: <strong>{latest ? latest.value : "—"}</strong>{latest ? ` at ${new Date(latest.timestamp).toLocaleTimeString()}` : "; no data"}. Showing {Math.min(windowSize, ...visibleSeries.map((item) => item.points.length), windowSize)} points maximum.</p>
      {showTable ? <TelemetryTable rows={tableRows} /> : <LineChart height={210} labels={labels} series={chartSeries} />}
    </section>
  );
}

function TelemetryTable({ rows }: Readonly<{ rows: ReturnType<typeof telemetryTableRows> }>) {
  const labels = rows[0]?.values.map((value) => value.label) ?? [];
  return <div className="oarc-live-chart-table-wrap" tabIndex={0} aria-label="Telemetry table"><table className="oarc-live-chart-table"><caption>Telemetry values by timestamp</caption><thead><tr><th scope="col">Time</th>{labels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.timestamp}><th scope="row">{new Date(row.timestamp).toLocaleTimeString()}</th>{row.values.map((value) => <td key={value.label}>{value.value ?? "—"}</td>)}</tr>)}</tbody></table></div>;
}
