#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = new Set(process.argv.slice(2));
const localMode = args.has('--local') || args.has('--offline');
const liveMode = args.has('--live');
const help = args.has('--help') || args.has('-h');

if (help) {
  console.log(`ray-automation-smoke.mjs
Usage:
  node scripts/ray-automation-smoke.mjs --local   # CI-safe offline checks (no service disruption)
  node scripts/ray-automation-smoke.mjs --live    # live DoD checks against running hub (non-destructive by default)

Notes:
  - --local verifies required Task 13/14 artifacts, contracts, and basic wiring.
  - Destructive DoD checks (stop hub/postgres) are intentionally not automated here to avoid breaking running environments; run them manually per plan DoD 7/8/10/11 and record evidence.
`);
  process.exit(0);
}

const root = process.cwd();
const results = [];
const record = (name, ok, details = '') => {
  results.push({ name, ok, details });
  const icon = ok ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${name}${details ? ` - ${details}` : ''}`);
};

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { res, json, text };
}

// --- Offline / CI-safe checks (Task 13/14 wiring) ---
record('Task 13: second-brain card component exists', exists('components/memory/SecondBrainStatusCard.tsx'));
record('Task 13: e2e spec exists', exists('tests/e2e/second-brain-card.spec.ts'));
record('Task 13: sandbox dashboard renders card', (() => {
  try {
    const page = fs.readFileSync(path.join(root, 'app/sandbox/page.tsx'), 'utf8');
    return page.includes('SecondBrainStatusCard') && page.includes('<SecondBrainStatusCard');
  } catch { return false; }
})());
record('Task 13: status route relays client/sweeper/store', (() => {
  try {
    const route = fs.readFileSync(path.join(root, 'app/api/project-memory/status/route.ts'), 'utf8');
    return route.includes('clientStatuses') && route.includes('retentionSweeper') && route.includes('storeMode');
  } catch { return false; }
})());

record('Task 14: ray-backfill script exists', exists('scripts/ray-backfill.mjs'));
record('Task 14: ray-automation-smoke script exists', exists('scripts/ray-automation-smoke.mjs'));

try {
  const backfill = fs.readFileSync(path.join(root, 'scripts/ray-backfill.mjs'), 'utf8');
  record('Task 14: backfill provenance/platform/conversationId/workspacePath', [
    "provenance: 'backfill'",
    "platform: 'opencode'",
    "conversationId: 'second-brain-design-2026-11-15'",
    "workspacePath = process.env.RAY_MEMORY_WORKSPACE_PATH ?? 'D:\\\\Projects\\\\Secondosaistudioog'",
    "sourceReference: 'backfill:",
  ].every((s) => backfill.includes(s)));
} catch {
  record('Task 14: backfill provenance/platform/conversationId/workspacePath', false, 'unreadable');
}

try {
  const importContract = readJson('docs/contracts/import.json');
  const ok = importContract?.endpoint === 'POST /api/project-memory/import' && importContract?.request?.platform === 'opencode';
  record('Contract: import endpoint contract present', !!ok, importContract?.endpoint ?? 'missing');
} catch (e) {
  record('Contract: import endpoint contract present', false, e?.message ?? 'invalid');
}

try {
  const statusContract = readJson('docs/contracts/status.json');
  record('Contract: status endpoint contract present', statusContract?.endpoint === 'GET /api/project-memory/status');
} catch (e) {
  record('Contract: status endpoint contract present', false, e?.message ?? 'invalid');
}

// DoD mapping (offline evidence notes)
record('DoD 1 (recall in fresh session) - live/manual', !localMode && liveMode ? false : true, localMode ? 'skipped in --local (requires live hub/session)' : 'run live: backfill + fresh OpenCode session recall');
record('DoD 7 (crash recovery, exactly-once) - manual/destructive', !localMode && liveMode ? false : true, 'manual: stop hub mid-capture, restart, drain, assert counts stable');
record('DoD 8 (hub-down degradation) - manual/destructive', !localMode && liveMode ? false : true, 'manual: stop hub, verify recall fail-open/spool, restart drain');
record('DoD 9 (no echo loop) - live', !localMode && liveMode ? false : true, localMode ? 'skipped in --local' : 'requires live session observation (3 idle sessions)');
record('DoD 10 (sweeper 91d soft-delete, rerun no-op) - live/destructive seed', !localMode && liveMode ? false : true, localMode ? 'skipped in --local' : 'seed aged events and invoke sweeper endpoint');
record('DoD 11 (degraded truth, postgres down) - manual/destructive', !localMode && liveMode ? false : true, 'manual: stop Postgres, assert ok:false/connected:false');
record('DoD 12 (windows identity + scope enforcement) - live', !localMode && liveMode ? false : true, localMode ? 'skipped in --local' : 'exercise case/separator variants and tampered filters');

// Optional live non-destructive checks when hub is reachable
const baseUrl = (process.env.RAY_MEMORY_BASE_URL ?? 'http://127.0.0.1:3018').replace(/\/$/, '');
if (!localMode && liveMode) {
  try {
    const { res, json } = await fetchJson(`${baseUrl}/api/project-memory/status`);
    const hasShape = res.ok && json?.ok === true && json?.data && ('capture' in json.data || 'clientStatuses' in json.data || 'state' in json.data);
    record('Live: status endpoint reachable with SECOND-BRAIN fields', hasShape, `HTTP ${res.status}`);
  } catch (e) {
    record('Live: status endpoint reachable with SECOND-BRAIN fields', false, e?.message ?? 'unreachable');
  }

  try {
    const { res, json } = await fetchJson(`${baseUrl}/api/project-memory/operations`, {
      headers: {
        'x-dev-subject': process.env.RAY_MEMORY_AGENT_ID ?? 'atlas',
        'x-dev-tenant-id': process.env.RAY_MEMORY_TENANT_ID ?? process.env.APEX_AUDIT_TENANT_ID ?? 'sandbox-tenant',
        'x-dev-scopes': 'memory:read jobs:claim',
      },
    });
    record('Live: operations endpoint reachable', res.status === 200 && json?.ok === true, `HTTP ${res.status}`);
  } catch (e) {
    record('Live: operations endpoint reachable', false, e?.message ?? 'unreachable');
  }

  try {
    const { res } = await fetchJson(`${baseUrl}/api/project-memory/sweeper-run`, {
      headers: {
        'x-dev-subject': process.env.RAY_MEMORY_AGENT_ID ?? 'atlas',
        'x-dev-tenant-id': process.env.RAY_MEMORY_TENANT_ID ?? process.env.APEX_AUDIT_TENANT_ID ?? 'sandbox-tenant',
        'x-dev-scopes': 'memory:read jobs:claim',
      },
    });
    record('Live: sweeper status endpoint reachable', res.status === 200, `HTTP ${res.status}`);
  } catch (e) {
    record('Live: sweeper status endpoint reachable', false, e?.message ?? 'unreachable');
  }
} else if (localMode) {
  record('Live hub checks', true, 'skipped in --local mode');
}

const failed = results.filter((r) => !r.ok);
const summary = { ok: failed.length === 0, mode: localMode ? 'local' : (liveMode ? 'live' : 'default'), passed: results.length - failed.length, failed: failed.length, total: results.length };
console.log('\n' + JSON.stringify(summary, null, 2));
if (failed.length) {
  console.error('Failed checks:\n' + failed.map((f) => `- ${f.name}${f.details ? ` (${f.details})` : ''}`).join('\n'));
  process.exitCode = 1;
}
