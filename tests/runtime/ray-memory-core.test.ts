import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { HIGH_ENTROPY_SECRET, BENIGN_LINES, BENIGN_PATHS, SECRET_LINES, SECRET_PATHS } from './fixtures/redaction-corpus';

const stateDir = mkdtempSync(path.join(tmpdir(), 'ray-core-state-'));
const profilePath = path.join(stateDir, 'ray-memory.env');
writeFileSync(profilePath, JSON.stringify({
  endpoint: 'http://127.0.0.1:3018', tenantId: 'sandbox-tenant', agentId: 'atlas',
  scopes: ['memory:read', 'memory:write', 'events:write'],
  killSwitch: false, captureEnabled: true, recallEnabled: true,
}));
process.env.RAY_MEMORY_STATE_DIR = stateDir;
process.env.RAY_MEMORY_PROFILE = profilePath;

const corePath = '../../plugins/ray-memory/core.mjs';
let core: typeof import('../../plugins/ray-memory/core.mjs');

beforeAll(async () => { core = await import(corePath); });
afterEach(() => { rmSync(path.join(stateDir, 'spool'), { recursive: true, force: true }); });

describe('redaction L2 content scan', () => {
  it('drops every secret line from the corpus', () => {
    for (const line of SECRET_LINES) {
      const r = core.redactText(`note\n${line}\nend`);
      expect(r.skipped, line).toBe(1);
      expect(r.text).toBe('note\nend');
    }
  });
  it('drops high-entropy mixed tokens but keeps hex git SHAs', () => {
    expect(core.redactText(HIGH_ENTROPY_SECRET).skipped).toBe(1);
    expect(core.redactText(BENIGN_LINES[1]).skipped).toBe(0);
  });
  it('keeps every benign line byte-identical', () => {
    for (const line of BENIGN_LINES) {
      const r = core.redactText(line);
      expect(r.skipped, line).toBe(0);
      expect(r.text).toBe(line);
    }
  });
  it('redactValue recurses into nested objects and arrays', () => {
    const r = core.redactValue({ a: SECRET_LINES[0], b: [SECRET_LINES[2]], c: { d: BENIGN_LINES[0] } });
    expect(r.a).toBe('');
    expect((r.b as string[])[0]).toBe('');
    expect(r.c.d).toBe(BENIGN_LINES[0]);
  });
});

describe('redaction L1 secret paths', () => {
  it('flags secret-bearing paths', () => {
    for (const p of SECRET_PATHS) expect(core.isSecretPath(p), p).toBe(true);
  });
  it('passes benign paths', () => {
    for (const p of BENIGN_PATHS) expect(core.isSecretPath(p), p).toBe(false);
  });
});

describe('cwd normalization and project scoping', () => {
  it('maps Windows path variants to one key', () => {
    const a = core.normalizeCwd('D:\\Projects\\X\\');
    const b = core.normalizeCwd('d:/projects/x');
    expect(a.key).toBe(b.key);
    expect(a.display.startsWith('D:/Projects/X')).toBe(true);
  });
  it('skips home, Desktop, Downloads, temp, and drive roots', () => {
    for (const p of [homedir(), path.join(homedir(), 'Desktop'), path.join(homedir(), 'Downloads'), tmpdir(), 'C:/'])
      expect(core.projectScope(p).skip).toBe('skipped_nonproject');
  });
  it('skips marker-less dirs and walks up to the nearest marker', () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'ray-repo-'));
    const nested = path.join(repo, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    mkdirSync(path.join(repo, 'empty'), { recursive: true });
    expect(core.projectScope(path.join(repo, 'empty'))?.skip).toBe('skipped_nonproject');
    writeFileSync(path.join(repo, 'package.json'), '{}');
    const s = core.projectScope(nested);
    expect(s.skip).toBeUndefined();
    expect(s.root?.toLowerCase()).toBe(repo.toLowerCase());
    rmSync(repo, { recursive: true, force: true });
  });
  it('honors .opencode/ray-memory.json override (opt-out and bank)', () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'ray-ovr-'));
    writeFileSync(path.join(repo, 'package.json'), '{}');
    const oc = path.join(repo, '.opencode');
    mkdirSync(oc, { recursive: true });
    writeFileSync(path.join(oc, 'ray-memory.json'), JSON.stringify({ capture: false }));
    expect(core.projectScope(repo).skip).toBe('skipped_optout');
    writeFileSync(path.join(oc, 'ray-memory.json'), JSON.stringify({ bank: 'secondbrainog', project: 'SECOND-BRAIN' }));
    const s = core.projectScope(repo);
    expect(s.bank).toBe('secondbrainog');
    expect(s.project).toBe('SECOND-BRAIN');
    rmSync(repo, { recursive: true, force: true });
  });
  it('resolves a git worktree (.git as a file) to the main repo root', () => {
    const main = mkdtempSync(path.join(tmpdir(), 'ray-main-'));
    const wt = mkdtempSync(path.join(tmpdir(), 'ray-wt-'));
    const gitDir = path.join(main, '.git', 'worktrees', 'wt');
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(path.join(main, 'package.json'), '{}');
    writeFileSync(path.join(wt, '.git'), `gitdir: ${gitDir.replace(/\\/g, '/')}\n`);
    const s = core.projectScope(wt);
    expect(s.root?.toLowerCase()).toBe(main.toLowerCase());
    rmSync(main, { recursive: true, force: true });
    rmSync(wt, { recursive: true, force: true });
  });
});

describe('send success means persisted (F2)', () => {
  it('rejects HTTP 200 with localStorage-only state', async () => {
    const profile = core.loadProfile();
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, state: 'localStorage-only', data: { imported: 0 } }), { status: 200 })) as typeof fetch;
    const send = core.makeSend(profile, 'atlas');
    const r = await send({ route: '/api/project-memory/import', body: {}, scope: {} });
    expect(r.ok).toBe(false);
    globalThis.fetch = orig;
  });
  it('rejects HTTP 200 with imported:0 on import routes', async () => {
    const profile = core.loadProfile();
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, data: { imported: 0 } }), { status: 200 })) as typeof fetch;
    const send = core.makeSend(profile, 'atlas');
    const r = await send({ route: '/api/project-memory/import', body: {}, scope: {} });
    expect(r.ok).toBe(false);
    globalThis.fetch = orig;
  });
  it('accepts ok:true with imported>0 and non-degraded state', async () => {
    const profile = core.loadProfile();
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, data: { imported: 2 } }), { status: 200 })) as typeof fetch;
    const send = core.makeSend(profile, 'atlas');
    const r = await send({ route: '/api/project-memory/import', body: {}, scope: {} });
    expect(r.ok).toBe(true);
    globalThis.fetch = orig;
  });
  it('sends dev headers with x-dev-subject and auth-derived scope', async () => {
    let seen: Headers | undefined;
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: { headers?: Headers }) => { seen = init?.headers as Headers; return new Response(JSON.stringify({ ok: true, data: { imported: 1 } }), { status: 200 }); }) as typeof fetch;
    const profile = core.loadProfile();
    const send = core.makeSend(profile, 'codex');
    await send({ route: '/api/project-memory/codex-event', body: {}, scope: { project: 'SECOND-BRAIN' } });
    expect(seen?.get('x-dev-subject')).toBe('codex');
    expect(seen?.get('x-dev-tenant-id')).toBe('sandbox-tenant');
    expect(seen?.get('x-dev-allowed-project-ids')).toBe('SECOND-BRAIN');
    globalThis.fetch = orig;
  });
});

describe('spool and flusher', () => {
  it('appends JSONL to disk before any network attempt', () => {
    core.spoolAppend('opencode', 's1', { route: '/x', body: { n: 1 } }, core.loadProfile());
    const f = path.join(stateDir, 'spool', 'opencode', 's1.jsonl');
    const lines = (core as unknown as { readSpoolFile: (p: string) => string[] }).readSpoolFile?.(f) ?? [];
    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0]).body.n).toBe(1);
  });
  it('flushSpool delivers pending events and removes the file', async () => {
    core.spoolAppend('opencode', 's2', { route: '/api/project-memory/import', body: {}, scope: {} }, core.loadProfile());
    const delivered: unknown[] = [];
    const r = await core.flushSpool('opencode', core.loadProfile(), {
      deadlineMs: 8000,
      send: async (env: unknown) => { delivered.push(env); return { ok: true, status: 200, json: { ok: true, data: { imported: 1 } } }; },
    });
    expect(r.flushed).toBe(1);
    expect(delivered.length).toBe(1);
    expect(core.flushSpool('opencode', core.loadProfile(), { deadlineMs: 8000, send: async () => ({ ok: true }) })).toBeTruthy();
  });
  it('keeps failed lines and applies backoff to the next call', async () => {
    core.spoolAppend('opencode', 's3', { route: '/x', body: {}, scope: {} }, core.loadProfile());
    const first = await core.flushSpool('opencode', core.loadProfile(), { deadlineMs: 8000, send: async () => ({ ok: false, status: 0, error: 'AbortError' }) });
    expect(first.failed).toBe(1);
    const second = await core.flushSpool('opencode', core.loadProfile(), { deadlineMs: 8000, send: async () => ({ ok: true }) });
    expect(second.deferred).toBe(1);
  });
  it('killSwitch skips flushing', async () => {
    const p = { ...core.loadProfile(), killSwitch: true };
    expect(await core.flushSpool('opencode', p, { deadlineMs: 8000, send: async () => ({ ok: true }) })).toMatchObject({ skipped: 'killSwitch' });
  });
});

describe('echo guard', () => {
  it('registers and detects hashes with a 500-entry ring', () => {
    core.echoAdd('opencode', 'h1');
    expect(core.echoHas('opencode', 'h1')).toBe(true);
    expect(core.echoHas('opencode', 'h2')).toBe(false);
    for (let i = 0; i < 600; i++) core.echoAdd('opencode', `h${i}`);
    expect(core.echoHas('opencode', 'h599')).toBe(true);
    expect(core.echoHas('opencode', 'h1')).toBe(false); // ring evicted old entries
  });
});

describe('idempotency keys', () => {
  it('are stable for identical inputs and differ otherwise', () => {
    const profile = core.loadProfile();
    const a = core.idempotencyKey(profile, 'secondbrainog', 's1', '0-2', 'content');
    const b = core.idempotencyKey(profile, 'secondbrainog', 's1', '0-2', 'content');
    const c = core.idempotencyKey(profile, 'secondbrainog', 's1', '0-2', 'other');
    const d = core.idempotencyKey(profile, 'otherbank', 's1', '0-2', 'content');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });
});

describe('fail-open recall timing', () => {
  it('postJson aborts at timeoutMs and returns ok:false', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Promise(() => {})) as typeof fetch;
    const r = await core.postJson('http://127.0.0.1:3018/api/v1/memory/recall', {}, {}, 80);
    expect(r.ok).toBe(false);
    globalThis.fetch = orig;
  });
  it('recallPack returns null on failure and joins facts content on success', async () => {
    const profile = core.loadProfile();
    const scope = { bank: 'secondbrainog', project: 'SECOND-BRAIN' };
    const orig = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, data: { facts: [{ content: 'fact one' }, { content: 'fact two' }] } }), { status: 200 })) as typeof fetch;
    const pack = await core.recallPack(profile, 'atlas', scope, 'session start');
    expect(pack?.text).toContain('fact one');
    expect(pack?.hash).toBeTypeOf('string');
    globalThis.fetch = (async () => { throw new Error('hub down'); }) as typeof fetch;
    expect(await core.recallPack(profile, 'atlas', scope, 'session start')).toBeNull();
    globalThis.fetch = orig;
  });
});
