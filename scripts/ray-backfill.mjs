#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DESIGN_PATH = path.join(ROOT, 'docs', 'superpowers', 'specs', '2026-11-15-second-brain-full-automation-design-v2.md');

const endpoint = (process.env.RAY_MEMORY_BASE_URL ?? 'http://127.0.0.1:3018').replace(/\/$/, '') + '/api/project-memory/import';
const tenantId = process.env.RAY_MEMORY_TENANT_ID ?? process.env.APEX_AUDIT_TENANT_ID ?? 'sandbox-tenant';
const bankId = process.env.RAY_MEMORY_BANK_ID ?? process.env.APEX_AUDIT_BANK_ID ?? 'secondbrainog';
const projectId = process.env.RAY_MEMORY_PROJECT_ID ?? process.env.APEX_AUDIT_PROJECT_ID ?? 'SECOND-BRAIN';
const workspacePath = process.env.RAY_MEMORY_WORKSPACE_PATH ?? 'D:\\Projects\\Secondosaistudioog';
const agentId = process.env.RAY_MEMORY_AGENT_ID ?? 'atlas';

function chunkText(text, max = 6000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += max) chunks.push(text.slice(i, i + max));
  return chunks.length ? chunks : [''];
}

async function main() {
  let design = '';
  try {
    design = await fs.readFile(DESIGN_PATH, 'utf8');
  } catch (err) {
    console.error(`Failed to read design doc at ${DESIGN_PATH}:`, err?.message ?? err);
    process.exitCode = 2;
    return;
  }

  const summary = design.slice(0, 24000);
  const chunks = chunkText(summary, 6000);
  const messages = [
    { role: 'user', content: 'Backfill: SECOND-BRAIN full automation design conversation (2026-11-15). Capture the agreed architecture, decisions, and DoD for project SECOND-BRAIN.' },
    ...chunks.map((c, i) => ({ role: 'assistant', content: i === 0 ? `Design v2 content (part ${i + 1}/${chunks.length}):\n\n${c}` : `Design v2 content (part ${i + 1}/${chunks.length}):\n\n${c}` })),
    { role: 'assistant', content: 'Backfill provenance: opencode conversationId=second-brain-design-2026-11-15, workspacePath=D:\\Projects\\Secondosaistudioog, projectId=SECOND-BRAIN.' },
  ];

  const body = {
    tenantId,
    bankId,
    projectId,
    workspacePath,
    platform: 'opencode',
    conversationId: 'second-brain-design-2026-11-15',
    exportedAt: new Date().toISOString(),
    sourceReference: 'backfill:docs/superpowers/specs/2026-11-15-second-brain-full-automation-design-v2.md',
    messages,
  };

  const headers = {
    'content-type': 'application/json',
    'x-dev-subject': agentId,
    'x-dev-tenant-id': tenantId,
    'x-dev-scopes': 'memory:read memory:write events:write',
    'x-dev-bank-id': bankId,
    'x-dev-project-id': projectId,
    'x-dev-allowed-project-ids': projectId,
  };

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    console.error(JSON.stringify({ ok: false, endpoint, status: res.status, body: json ?? text }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    endpoint,
    tenantId,
    bankId,
    projectId,
    conversationId: body.conversationId,
    provenance: 'backfill',
    platform: 'opencode',
    workspacePath,
    imported: json?.data?.imported ?? null,
    accepted: json?.data?.accepted ?? null,
    capture: json?.data?.capture ?? null,
    note: 'Idempotent by conversation/message identity and hub dedup; safe to re-run (counts may remain stable).',
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? String(err));
  process.exitCode = 1;
});
