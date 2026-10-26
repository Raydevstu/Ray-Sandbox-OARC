import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, authorize } from '@/lib/runtime/auth';
import { parseRuntimeConfig } from '@/lib/runtime/config';
import { createRuntimeRepository, isRuntimeStoreConfigured } from '@/lib/runtime/repository';
import { replayProjectMemoryAtSequence } from '@/lib/runtime/project-memory';
import { generateProjectManifest, renderProjectManifestMarkdown } from '@/lib/runtime/project-manifest';

const QuerySchema = z.object({ tenantId: z.string().min(1), bankId: z.string().min(1), projectId: z.string().min(1), format: z.enum(['json', 'markdown']).optional(), atSequence: z.coerce.number().int().positive().optional() });

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request, parseRuntimeConfig(process.env));
    const query = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    authorize(principal, 'memory:read', query);
    if (!isRuntimeStoreConfigured()) return NextResponse.json({ ok: false, error: 'canonical store is not configured' }, { status: 503 });
    const scope = { tenantId: query.tenantId, bankId: query.bankId };
    const repository = createRuntimeRepository(scope);
    const events = await repository.listProjectEvents(scope, query.projectId);
    const projection = replayProjectMemoryAtSequence(events, query.atSequence);
    const manifest = generateProjectManifest(query.projectId, projection, new Date().toISOString());
    if (query.format === 'markdown') return new Response(renderProjectManifestMarkdown(manifest), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
    return NextResponse.json({ ok: true, data: manifest });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'invalid manifest query' : error instanceof Error ? error.message : 'manifest read failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('credential') ? 401 : message.includes('scope') || message.includes('permission') ? 403 : 400 });
  }
}
