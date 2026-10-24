import { request } from '@playwright/test';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

export default async function globalSetup() {
  const context = await request.newContext({ baseURL });
  try {
    const health = await context.get('/api/v1/health');
    if (!health.ok()) throw new Error(`Ray Sandbox OARC health failed: HTTP ${health.status()}`);
    const healthBody = await health.json() as { ok?: boolean; data?: { status?: string } };
    if (healthBody.ok !== true || healthBody.data?.status !== 'ok') throw new Error('Ray Sandbox OARC health payload was not healthy');

    const ready = await context.get('/api/v1/ready');
    if (!ready.ok()) throw new Error(`Ray Sandbox OARC readiness failed: HTTP ${ready.status()}`);

    const page = await context.get('/sandbox');
    if (!page.ok()) throw new Error(`Ray Sandbox OARC page failed: HTTP ${page.status()}`);
    const html = await page.text();
    if (!html.includes('Ray Sandbox OARC')) throw new Error('E2E target is not Ray Sandbox OARC');
    if (!html.includes('/_next/static/')) throw new Error('Ray Sandbox OARC assets were not present in the page');
    if (!baseURL.includes('3000') && !process.env.E2E_BASE_URL) throw new Error(`Unexpected default E2E target: ${baseURL}`);
    const databaseUrl = process.env.APEX_DATABASE_URL ?? readFileSync('.env.local', 'utf8').match(/^APEX_DATABASE_URL=(.*)$/m)?.[1]?.trim();
    if (databaseUrl?.startsWith('postgres')) {
      const pool = new Pool({ connectionString: databaseUrl, max: 1 });
      try {
        await pool.query("INSERT INTO tenants (id, created_at) VALUES ('staging-tenant', NOW()) ON CONFLICT (id) DO NOTHING");
        await pool.query("INSERT INTO banks (id, tenant_id, created_at) VALUES ('staging-bank', 'staging-tenant', NOW()) ON CONFLICT (tenant_id, id) DO NOTHING");
      } finally {
        await pool.end();
      }
    }
  } finally {
    await context.dispose();
  }
}
