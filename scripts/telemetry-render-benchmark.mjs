import { performance } from "node:perf_hooks";

const pointCounts = [30, 120, 600, 1200];
const chartSets = [1, 4];
const iterations = 200;

function buildSeries(seriesCount, pointCount) {
  return Array.from({ length: seriesCount }, (_, seriesIndex) => ({
    id: `series-${seriesIndex}`,
    label: `Series ${seriesIndex}`,
    points: Array.from({ length: pointCount }, (_, pointIndex) => ({
      timestamp: pointIndex,
      value: (pointIndex + seriesIndex) % 100,
    })),
  }));
}

function chartModel(series) {
  const visible = series.map((item) => item.points.slice(-120));
  const labels = visible[0]?.map((point) => point.timestamp) ?? [];
  const rows = [...new Set(visible.flatMap((item) => item.map((point) => point.timestamp)))].sort((a, b) => b - a).map((timestamp) =>
    visible.map((item) => item.find((point) => point.timestamp === timestamp)?.value ?? null),
  );
  return { visible, labels, rows };
}

const results = [];
for (const chartCount of chartSets) {
  for (const pointCount of pointCounts) {
    const source = buildSeries(chartCount * 3, pointCount);
    const started = performance.now();
    for (let iteration = 0; iteration < iterations; iteration += 1) chartModel(source);
    const elapsed = performance.now() - started;
    results.push({ chartCount, pointCount, averageMs: Number((elapsed / iterations).toFixed(3)), totalMs: Number(elapsed.toFixed(1)) });
  }
}

console.table(results);
console.log(`iterations=${iterations}; benchmark measures telemetry-to-chart model preparation, not browser paint/compositing`);
