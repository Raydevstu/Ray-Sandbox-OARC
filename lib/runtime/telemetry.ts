export type OarcPointStatus = "normal" | "warning" | "critical";

export type OarcPoint = Readonly<{
  timestamp: number;
  value: number;
  label?: string;
  status?: OarcPointStatus;
}>;

export type OarcColorToken = "primary" | "secondary" | "tertiary" | "alert" | "critical";

export type OarcSeries = Readonly<{
  id: string;
  label: string;
  points: readonly OarcPoint[];
  colorToken: OarcColorToken;
  lineStyle: "solid" | "dashed" | "dotted";
  enabled: boolean;
}>;

export type TelemetryConnection = "live" | "stale" | "disconnected";

export type TelemetrySnapshot = Readonly<{
  series: readonly OarcSeries[];
  connection: TelemetryConnection;
  lastEventAt: number | null;
}>;

export type TelemetryStreamState = "live" | "paused" | "stale" | "disconnected";

export type TelemetryEvent = Readonly<{
  seriesId: string;
  point: OarcPoint;
}>;

export type SandboxTelemetryEvent = Readonly<{
  id: string;
  at: string;
  app: string;
  op: string;
  latencyMs?: number;
  tokens?: number;
}>;

export type TelemetryStreamSnapshot = Readonly<{
  series: readonly OarcSeries[];
  state: TelemetryStreamState;
  lastEventAt: number | null;
}>;

export type RenderCostSample = Readonly<{
  measuredAt: number;
  milliseconds: number;
}>;

export const DEFAULT_TELEMETRY_LIMIT = 120;

export function createTelemetryStreamSnapshot(series: readonly OarcSeries[], state: TelemetryStreamState = "live"): TelemetryStreamSnapshot {
  return { series: series.map((item) => ({ ...item, points: [...item.points] })), state, lastEventAt: null };
}

export function ingestTelemetryEvent(snapshot: TelemetryStreamSnapshot, event: TelemetryEvent, limit = DEFAULT_TELEMETRY_LIMIT): TelemetryStreamSnapshot {
  if (snapshot.state !== "live") return snapshot;
  let matched = false;
  const series = snapshot.series.map((item) => {
    if (item.id !== event.seriesId) return item;
    matched = true;
    return appendBoundedSeries(item, event.point, limit);
  });
  return matched ? { ...snapshot, series, lastEventAt: event.point.timestamp } : snapshot;
}

export function telemetryEventsFromSandboxEvent(event: SandboxTelemetryEvent): readonly TelemetryEvent[] {
  const timestamp = Date.parse(event.at);
  if (!Number.isFinite(timestamp)) return [];
  const operation = event.op === "retain" || event.op === "recall" || event.op === "reflect" ? event.op : "system";
  const events: TelemetryEvent[] = [{ seriesId: operation, point: { timestamp, value: 1 } }];
  if (event.latencyMs !== undefined) events.push({ seriesId: `${operation}-latency`, point: { timestamp, value: event.latencyMs } });
  if (event.tokens !== undefined) events.push({ seriesId: "tokens", point: { timestamp, value: event.tokens } });
  return events;
}

export function setTelemetryStreamState(snapshot: TelemetryStreamSnapshot, state: TelemetryStreamState): TelemetryStreamSnapshot {
  return snapshot.state === state ? snapshot : { ...snapshot, state };
}

export function deriveTelemetryStreamState(snapshot: TelemetryStreamSnapshot, now: number, staleAfterMs = 10_000): TelemetryStreamState {
  if (snapshot.state === "paused" || snapshot.state === "disconnected") return snapshot.state;
  if (snapshot.lastEventAt === null || now - snapshot.lastEventAt > Math.max(0, staleAfterMs)) return "stale";
  return "live";
}

export function pushBounded<T>(items: readonly T[], item: T, limit = DEFAULT_TELEMETRY_LIMIT): readonly T[] {
  const safeLimit = Math.max(1, Math.floor(limit));
  return [...items, item].slice(-safeLimit);
}

export function appendBoundedPoint(points: readonly OarcPoint[], point: OarcPoint, limit = DEFAULT_TELEMETRY_LIMIT): readonly OarcPoint[] {
  return pushBounded(points, point, limit);
}

export function appendBoundedSeries(series: OarcSeries, point: OarcPoint, limit = DEFAULT_TELEMETRY_LIMIT): OarcSeries {
  return { ...series, points: appendBoundedPoint(series.points, point, limit) };
}

export function zoomSeries(series: OarcSeries, visiblePoints: number): OarcSeries {
  const count = Math.max(1, Math.floor(visiblePoints));
  return { ...series, points: series.points.slice(-count) };
}

export function currentPoint(series: readonly OarcSeries[]): OarcPoint | null {
  return series.flatMap((item) => item.enabled ? item.points : []).sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
}

export function telemetryTableRows(series: readonly OarcSeries[]): readonly Readonly<{ timestamp: number; values: readonly Readonly<{ label: string; value: number | null }>[] }> [] {
  const timestamps = [...new Set(series.flatMap((item) => item.points.map((point) => point.timestamp)))].sort((a, b) => b - a);
  return timestamps.map((timestamp) => ({
    timestamp,
    values: series.filter((item) => item.enabled).map((item) => ({ label: item.label, value: item.points.find((point) => point.timestamp === timestamp)?.value ?? null })),
  }));
}

export function recordRenderCost(startedAt: number, measuredAt = performance.now()): RenderCostSample {
  return { measuredAt: Date.now(), milliseconds: Math.max(0, measuredAt - startedAt) };
}
