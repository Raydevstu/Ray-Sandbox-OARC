import assert from "node:assert/strict";
import { describe, it as test } from "vitest";
import { BENCHMARK_ROUTES, benchmarkMarkdown, runScenarioBenchmark } from "../benchmark";

describe("full scenario benchmark", () => {
  test("covers every sandbox surface", () => {
    assert.equal(BENCHMARK_ROUTES.length, 10);
    assert.ok(BENCHMARK_ROUTES.includes("/sandbox/memory"));
    assert.ok(BENCHMARK_ROUTES.includes("/sandbox/integrations"));
  });

  test("runs multi-scenario feature checks with before/after metrics", () => {
    const report = runScenarioBenchmark();
    assert.ok(report.metrics.length >= 8);
    assert.equal(report.passRate, 100);
    assert.ok(report.afterAccuracy >= 0);
    assert.match(benchmarkMarkdown(report), /Competitor\/reference comparison/);
  });
});
