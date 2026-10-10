import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { replayProjectMemoryAtSequence } from '@/lib/runtime/project-memory';
import { generateProjectManifest, renderProjectManifestMarkdown } from '@/lib/runtime/project-manifest';

const QuerySchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), format: z.enum(['json', 'markdown']).default('json'), atSequence: z.coerce.number().int().positive().optional() });

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const query = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    authorize(principal, 'memory:read', query);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured', retryable: true }, { status: 503 });
    const scope = { tenantId: query.tenantId, bankId: query.bankId };
    const events = await createRuntimeRepository(scope).listProjectEvents(scope, query.projectId);
    const manifest = generateProjectManifest(query.projectId, replayProjectMemoryAtSequence(events, query.atSequence), new Date().toISOString());
    if (query.format === 'markdown') return new Response(renderProjectManifestMarkdown(manifest), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': `attachment; filename="${query.projectId}-memory-manifest.md"` } });
    return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${query.projectId}-memory-manifest.json"` } });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid export query' : error instanceof Error ? error.message : 'export failed';
    const status = message.includes('credential') || message.includes('JWT') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : message.includes('not configured') ? 503 : 400;
    return NextResponse.json({ ok: false, error: message, retryable: status === 503 }, { status });
  }
}
