import process from 'node:process';
import { assertDeploymentResponse } from '../lib/runtime/deployment-gates.ts';

const baseUrl = (process.env.DEPLOYMENT_BASE_URL ?? 'http://127.0.0.1:3029').replace(/\/$/, '');
const maxLatencyMs = Number(process.env.DEPLOYMENT_MAX_LATENCY_MS ?? 500);
const timed = async (name, url, init) => { const started = performance.now(); try { const response = await fetch(url, init); const body = await response.text(); return { response, body, latencyMs: Math.round(performance.now() - started) }; } catch (error) { throw new Error(`${name} request failed: ${error instanceof Error ? error.message : String(error)}`); } };

try {
  const health = await timed('health', `${baseUrl}/api/v1/health`);
  const ready = await timed('readiness', `${baseUrl}/api/v1/ready`);
  const auth = await timed('authentication', `${baseUrl}/api/project-memory/operations`);
  const staticPage = await timed('static assets', `${baseUrl}/sandbox`);
  const parsed = (value) => { try { return JSON.parse(value); } catch { return {}; } };
  assertDeploymentResponse({
    health: parsed(health.body),
    ready: parsed(ready.body),
    healthStatus: health.response.status,
    readyStatus: ready.response.status,
    authStatus: auth.response.status,
    staticStatus: staticPage.response.status,
    staticHtml: staticPage.body,
    latencyMs: { health: health.latencyMs, ready: ready.latencyMs, auth: auth.latencyMs, static: staticPage.latencyMs },
  }, maxLatencyMs);
  console.log(`PASS production-like deployment gates (${baseUrl}; max latency ${maxLatencyMs}ms)`);
} catch (error) {
  console.error(`FAIL production-like deployment gates: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
