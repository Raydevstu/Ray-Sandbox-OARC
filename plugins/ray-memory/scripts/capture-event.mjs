import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import process from 'node:process';
import { buildCaptureEnvelope } from './capture-support.mjs';

const raw = await new Promise((resolve) => { let value = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (chunk) => { value += chunk; }); process.stdin.on('end', () => resolve(value)); });
let input;
try { input = raw ? JSON.parse(raw) : {}; } catch { input = { hook_event_name: 'codex-hook', parse_error: true }; }
const endpoint = process.env.CODEX_MEMORY_ENDPOINT ?? 'http://127.0.0.1:3028/api/project-memory/import';
const tenantId = process.env.CODEX_MEMORY_TENANT_ID ?? 'staging-tenant';
const bankId = process.env.CODEX_MEMORY_BANK_ID ?? 'staging-bank';
const candidateRoot = (value) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const gitRoot = (cwd) => new Promise((resolve) => {
  if (!cwd) return resolve(undefined);
  execFile('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { timeout: 1500, windowsHide: true }, (error, stdout) => resolve(error ? undefined : candidateRoot(stdout)));
});
const resolveRepositoryRoot = async (hookInput) => {
  const repository = hookInput?.repository && typeof hookInput.repository === 'object' ? hookInput.repository : {};
  const explicit = [hookInput?.project_root, hookInput?.projectRoot, hookInput?.repository_root, hookInput?.repo_root, repository.root, repository.path, hookInput?.workspace_root, hookInput?.workspaceRoot, hookInput?.workspace?.root, hookInput?.workspace?.path].map(candidateRoot).find(Boolean);
  if (explicit) return explicit;
  return gitRoot(candidateRoot(hookInput?.cwd) ?? process.cwd()) ?? candidateRoot(hookInput?.cwd) ?? process.cwd();
};
const readTranscript = async (transcriptPath) => {
  const safePath = candidateRoot(transcriptPath);
  if (!safePath) return '';
  try {
    const details = await stat(safePath);
    if (!details.isFile() || details.size > 512 * 1024) return '';
    return await readFile(safePath, { encoding: 'utf8' });
  } catch {
    return '';
  }
};
const hookInput = { ...input, tenantId, bankId, ...(process.env.CODEX_MEMORY_WORKSPACE_ID ? { workspaceId: process.env.CODEX_MEMORY_WORKSPACE_ID } : {}) };
const repositoryRoot = await resolveRepositoryRoot(hookInput);
const transcriptRaw = await readTranscript(hookInput.transcript_path);
const envelope = buildCaptureEnvelope(hookInput, { repositoryRoot, transcriptRaw });
const headers = { 'content-type': 'application/json', ...(process.env.CODEX_MEMORY_AUTHORIZATION ? { authorization: process.env.CODEX_MEMORY_AUTHORIZATION } : { 'x-dev-subject': 'codex-plugin-hook', 'x-dev-tenant-id': tenantId, 'x-dev-scopes': 'events:write memory:read memory:write' }) };
try {
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ tenantId, bankId, ...envelope }) });
  if (!response.ok) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
